/**
 * ============================================================================
 * DeadlineHub — Student Homework & Deadline Dashboard (script.js)
 * Vanilla JavaScript (ES6+)
 * 
 * Features:
 * 1. Student dashboard with live KPIs and completion progress bar.
 * 2. Add and edit homework with subject, description, due date & priority.
 * 3. Display upcoming deadlines sorted by urgency with relative countdowns.
 * 4. Toggle completion status with instant visual feedback.
 * 5. Delete homework with confirmation modal.
 * 6. Interacts with the Data Access Layer (storage.js / DeadlineStorage)
 *    so cloud databases (like Supabase) can be integrated without rewriting the UI.
 * ============================================================================
 */

// Theme storage key (handled locally for instant UI rendering)
const THEME_KEY = (window.DeadlineStorage && window.DeadlineStorage.THEME_KEY) || 'deadlinehub_theme';

// Application State (in-memory view model cache for filtering, sorting, and rendering)
let assignments = [];
let currentFilter = 'all'; // 'all' | 'pending' | 'due-today' | 'overdue' | 'completed'
let currentSearch = '';
let currentSubjectFilter = 'ALL';
let currentSort = 'due-asc';
let pendingDeleteId = null;

// DOM Elements Cache
const DOM = {
  // Theme
  themeToggleBtn: document.getElementById('themeToggleBtn'),

  // Header & Banner
  currentDateDisplay: document.getElementById('currentDateDisplay'),
  completionRateText: document.getElementById('completionRateText'),
  progressBarFill: document.getElementById('progressBarFill'),
  completionMetaText: document.getElementById('completionMetaText'),

  // KPI Counts
  totalTasksCount: document.getElementById('totalTasksCount'),
  pendingTasksCount: document.getElementById('pendingTasksCount'),
  overdueTasksCount: document.getElementById('overdueTasksCount'),
  completedTasksCount: document.getElementById('completedTasksCount'),
  displayedCountBadge: document.getElementById('displayedCountBadge'),

  // Filters & Controls
  searchInput: document.getElementById('searchInput'),
  clearSearchBtn: document.getElementById('clearSearchBtn'),
  subjectFilterSelect: document.getElementById('subjectFilterSelect'),
  sortBySelect: document.getElementById('sortBySelect'),
  filterTabs: document.querySelectorAll('.filter-tabs .tab-btn'),
  statCards: document.querySelectorAll('.stat-card'),

  // List & Empty State
  deadlinesList: document.getElementById('deadlinesList'),
  emptyState: document.getElementById('emptyState'),
  emptyStateTitle: document.getElementById('emptyStateTitle'),
  emptyStateMessage: document.getElementById('emptyStateMessage'),
  emptyAddBtn: document.getElementById('emptyAddBtn'),
  resetSampleDataBtn: document.getElementById('resetSampleDataBtn'),

  // Add / Edit Modal
  openModalBtn: document.getElementById('openModalBtn'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  cancelModalBtn: document.getElementById('cancelModalBtn'),
  homeworkModal: document.getElementById('homeworkModal'),
  homeworkForm: document.getElementById('homeworkForm'),
  modalTitle: document.getElementById('modalTitle'),
  saveBtnText: document.getElementById('saveBtnText'),

  // Form Inputs
  editHomeworkId: document.getElementById('editHomeworkId'),
  homeworkSubject: document.getElementById('homeworkSubject'),
  homeworkTitle: document.getElementById('homeworkTitle'),
  homeworkDescription: document.getElementById('homeworkDescription'),
  homeworkDueDate: document.getElementById('homeworkDueDate'),
  homeworkDueTime: document.getElementById('homeworkDueTime'),
  homeworkPriority: document.getElementById('homeworkPriority'),
  homeworkEstimatedTime: document.getElementById('homeworkEstimatedTime'),

  // Delete Modal
  deleteModal: document.getElementById('deleteModal'),
  deleteModalText: document.getElementById('deleteModalText'),
  closeDeleteModalBtn: document.getElementById('closeDeleteModalBtn'),
  cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
  confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),

  // Toast Container
  toastContainer: document.getElementById('toastContainer'),

  // Footer Actions
  backupDataBtn: document.getElementById('backupDataBtn'),
  restoreSampleBtn: document.getElementById('restoreSampleBtn'),
  clearAllBtn: document.getElementById('clearAllBtn')
};

/* ==========================================================================
   DATA LAYER INTEGRATION (Calling DeadlineStorage)
   ========================================================================== */

/**
 * Loads all assignments from the Data Access Layer into the local state.
 * This function calls the reusable DeadlineStorage.getAll() method.
 */
async function loadAssignments() {
  try {
    assignments = await DeadlineStorage.getAll();
  } catch (error) {
    console.error('[DeadlineHub] Error loading assignments:', error);
    showToast('Failed to load assignments', 'danger');
    assignments = [];
  }
}

/* ==========================================================================
   DATE & TIME UTILITIES
   ========================================================================== */

/**
 * Combines date string and time string into a valid JavaScript Date object.
 */
function parseDueDateTime(dueDateStr, dueTimeStr = '23:59') {
  if (!dueDateStr) return new Date();
  const time = dueTimeStr || '23:59';
  return new Date(`${dueDateStr}T${time}:00`);
}

/**
 * Checks if a given date is today in local time.
 */
function isDateToday(targetDate) {
  const now = new Date();
  return (
    targetDate.getDate() === now.getDate() &&
    targetDate.getMonth() === now.getMonth() &&
    targetDate.getFullYear() === now.getFullYear()
  );
}

/**
 * Returns deadline status: 'completed' | 'overdue' | 'due-today' | 'upcoming'
 */
function getDeadlineStatus(assignment) {
  if (assignment.completed) return 'completed';

  const now = new Date();
  const dueDate = parseDueDateTime(assignment.dueDate, assignment.dueTime);

  if (dueDate < now) {
    return 'overdue';
  } else if (isDateToday(dueDate)) {
    return 'due-today';
  } else {
    return 'upcoming';
  }
}

/**
 * Calculates human-friendly remaining time or overdue duration.
 */
function getRelativeTimeDescription(dueDateStr, dueTimeStr, isCompleted) {
  if (isCompleted) {
    return { text: 'Completed', className: 'completed' };
  }

  const now = new Date();
  const dueDate = parseDueDateTime(dueDateStr, dueTimeStr);
  const diffMs = dueDate - now;

  // Overdue
  if (diffMs < 0) {
    const overdueMs = Math.abs(diffMs);
    const overdueHours = Math.floor(overdueMs / (1000 * 60 * 60));
    const overdueDays = Math.floor(overdueHours / 24);

    if (overdueDays > 0) {
      return {
        text: `Overdue by ${overdueDays} day${overdueDays > 1 ? 's' : ''}`,
        className: 'overdue'
      };
    } else if (overdueHours > 0) {
      return {
        text: `Overdue by ${overdueHours} hour${overdueHours > 1 ? 's' : ''}`,
        className: 'overdue'
      };
    } else {
      return { text: 'Overdue just now', className: 'overdue' };
    }
  }

  // Upcoming
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (isDateToday(dueDate)) {
    if (diffHours < 1) {
      const diffMins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
      return { text: `Due in ${diffMins} min${diffMins > 1 ? 's' : ''}!`, className: 'due-today' };
    }
    return { text: `Due today (${diffHours}h left)`, className: 'due-today' };
  }

  if (diffDays === 1) {
    return { text: 'Due tomorrow', className: 'upcoming' };
  }

  return { text: `Due in ${diffDays} days`, className: 'upcoming' };
}

/**
 * Formats a date string (YYYY-MM-DD) and time (HH:MM) into a human readable string.
 * e.g., "Nov 20, 2026 at 5:00 PM"
 */
function formatHumanDate(dateStr, timeStr) {
  if (!dateStr) return 'No due date';
  const dateObj = parseDueDateTime(dateStr, timeStr);

  const datePart = dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  if (!timeStr) return datePart;

  const timePart = dateObj.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  return `${datePart} at ${timePart}`;
}

/**
 * Generates a consistent, attractive pastel color scheme for any subject string.
 */
function getSubjectColors(subject) {
  const hash = subject.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const palettes = [
    { bg: 'rgba(99, 102, 241, 0.12)', text: '#4f46e5' }, // Indigo
    { bg: 'rgba(14, 165, 233, 0.12)', text: '#0284c7' }, // Sky
    { bg: 'rgba(16, 185, 129, 0.12)', text: '#059669' }, // Emerald
    { bg: 'rgba(245, 158, 11, 0.12)', text: '#d97706' }, // Amber
    { bg: 'rgba(139, 92, 246, 0.12)', text: '#7c3aed' }, // Violet
    { bg: 'rgba(236, 72, 153, 0.12)', text: '#db2777' }  // Pink
  ];
  return palettes[hash % palettes.length];
}

/* ==========================================================================
   DASHBOARD METRICS & HEADER
   ========================================================================== */

/**
 * Updates header date banner with today's formatted date.
 */
function updateHeaderDate() {
  const today = new Date();
  const options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
  DOM.currentDateDisplay.textContent = today.toLocaleDateString('en-US', options);
}

/**
 * Computes counts and recalculates the completion progress bar.
 */
function updateDashboardStats() {
  const total = assignments.length;
  let completed = 0;
  let overdue = 0;
  let pending = 0;

  assignments.forEach((assignment) => {
    if (assignment.completed) {
      completed++;
    } else {
      const status = getDeadlineStatus(assignment);
      if (status === 'overdue') {
        overdue++;
      } else {
        pending++;
      }
    }
  });

  // Update KPI Number Counters
  DOM.totalTasksCount.textContent = total;
  DOM.completedTasksCount.textContent = completed;
  DOM.overdueTasksCount.textContent = overdue;
  DOM.pendingTasksCount.textContent = pending;

  // Calculate Completion Percentage
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
  DOM.completionRateText.textContent = `${percentage}%`;
  DOM.progressBarFill.style.width = `${percentage}%`;
  DOM.completionMetaText.textContent = `${completed} of ${total} assignment${total === 1 ? '' : 's'} completed`;
}

/**
 * Dynamically populates the subject filter dropdown based on available assignments.
 */
function updateSubjectDropdown() {
  const subjects = Array.from(new Set(assignments.map(a => a.subject.trim()))).filter(Boolean).sort();
  
  const currentVal = DOM.subjectFilterSelect.value;
  DOM.subjectFilterSelect.innerHTML = '<option value="ALL">All Subjects</option>';

  subjects.forEach(subject => {
    const opt = document.createElement('option');
    opt.value = subject;
    opt.textContent = subject;
    DOM.subjectFilterSelect.appendChild(opt);
  });

  if (subjects.includes(currentVal)) {
    DOM.subjectFilterSelect.value = currentVal;
  } else {
    DOM.subjectFilterSelect.value = 'ALL';
    currentSubjectFilter = 'ALL';
  }
}

/* ==========================================================================
   FILTERING & SORTING
   ========================================================================== */

function getFilteredAndSortedAssignments() {
  return assignments
    .filter(assignment => {
      // 1. Status Filter Tab
      const status = getDeadlineStatus(assignment);
      if (currentFilter === 'pending' && (assignment.completed || status === 'overdue')) return false;
      if (currentFilter === 'due-today' && (status !== 'due-today' || assignment.completed)) return false;
      if (currentFilter === 'overdue' && status !== 'overdue') return false;
      if (currentFilter === 'completed' && !assignment.completed) return false;

      // 2. Subject Filter
      if (currentSubjectFilter !== 'ALL' && assignment.subject !== currentSubjectFilter) {
        return false;
      }

      // 3. Search Query
      if (currentSearch) {
        const query = currentSearch.toLowerCase();
        const matchesSubject = assignment.subject.toLowerCase().includes(query);
        const matchesTitle = assignment.title.toLowerCase().includes(query);
        const matchesDesc = (assignment.description || '').toLowerCase().includes(query);
        if (!matchesSubject && !matchesTitle && !matchesDesc) return false;
      }

      return true;
    })
    .sort((a, b) => {
      // Completed items go to the bottom unless completed filter is selected
      if (currentFilter !== 'completed' && a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }

      switch (currentSort) {
        case 'due-asc': {
          const dateA = parseDueDateTime(a.dueDate, a.dueTime);
          const dateB = parseDueDateTime(b.dueDate, b.dueTime);
          return dateA - dateB;
        }
        case 'due-desc': {
          const dateA = parseDueDateTime(a.dueDate, a.dueTime);
          const dateB = parseDueDateTime(b.dueDate, b.dueTime);
          return dateB - dateA;
        }
        case 'priority-desc': {
          const priorityScore = { high: 3, medium: 2, low: 1 };
          return (priorityScore[b.priority] || 2) - (priorityScore[a.priority] || 2);
        }
        case 'subject-asc': {
          return a.subject.localeCompare(b.subject);
        }
        case 'created-desc':
        default: {
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        }
      }
    });
}

/* ==========================================================================
   RENDER DEADLINES LIST
   ========================================================================== */

function renderAssignments() {
  const items = getFilteredAndSortedAssignments();
  DOM.deadlinesList.innerHTML = '';
  DOM.displayedCountBadge.textContent = `${items.length} shown`;

  if (items.length === 0) {
    DOM.emptyState.classList.remove('hidden');

    if (currentSearch) {
      DOM.emptyStateTitle.textContent = 'No matching assignments';
      DOM.emptyStateMessage.textContent = `No results found for "${currentSearch}". Try a different search keyword.`;
    } else if (currentFilter === 'overdue') {
      DOM.emptyStateTitle.textContent = 'No overdue assignments! 🎉';
      DOM.emptyStateMessage.textContent = 'Awesome job! You are entirely on track with all your deadlines.';
    } else if (currentFilter === 'completed') {
      DOM.emptyStateTitle.textContent = 'No completed homework yet';
      DOM.emptyStateMessage.textContent = 'Mark assignments as completed once you finish them!';
    } else if (currentFilter === 'due-today') {
      DOM.emptyStateTitle.textContent = 'Nothing due today! ✨';
      DOM.emptyStateMessage.textContent = 'Take a breather or get a head start on tomorrow’s tasks.';
    } else {
      DOM.emptyStateTitle.textContent = 'No homework on your list';
      DOM.emptyStateMessage.textContent = 'Click "Add Homework" to start tracking your school deadlines!';
    }
    return;
  }

  DOM.emptyState.classList.add('hidden');

  items.forEach(assignment => {
    const card = createAssignmentCardElement(assignment);
    DOM.deadlinesList.appendChild(card);
  });
}

/**
 * Builds an interactive HTML card for an assignment.
 */
function createAssignmentCardElement(assignment) {
  const status = getDeadlineStatus(assignment);
  const relativeTime = getRelativeTimeDescription(assignment.dueDate, assignment.dueTime, assignment.completed);
  const formattedDueDate = formatHumanDate(assignment.dueDate, assignment.dueTime);
  const subjectColors = getSubjectColors(assignment.subject);

  const card = document.createElement('article');
  card.className = `homework-card status-${status} ${assignment.completed ? 'is-completed' : ''}`;
  card.setAttribute('data-id', assignment.id);

  // Priority Label
  const priorityLabels = {
    high: '🔥 High',
    medium: '⚡ Medium',
    low: '🌱 Low'
  };

  card.innerHTML = `
    <!-- Checkbox Column -->
    <div class="card-checkbox-col">
      <button 
        type="button" 
        class="custom-checkbox ${assignment.completed ? 'checked' : ''}" 
        data-action="toggle-complete" 
        aria-label="${assignment.completed ? 'Mark as incomplete' : 'Mark as complete'}"
        title="${assignment.completed ? 'Mark as incomplete' : 'Mark as complete'}"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </button>
    </div>

    <!-- Details Column -->
    <div class="card-details-col">
      <div class="card-top-row">
        <span class="subject-badge" style="background-color: ${subjectColors.bg}; color: ${subjectColors.text}">
          ${escapeHtml(assignment.subject)}
        </span>
        <span class="priority-badge ${assignment.priority || 'medium'}">
          ${priorityLabels[assignment.priority] || 'Medium'}
        </span>
        <span class="urgency-pill ${relativeTime.className}">
          ${relativeTime.text}
        </span>
      </div>

      <h4 class="card-title">${escapeHtml(assignment.title)}</h4>

      ${assignment.description ? `<p class="card-description">${escapeHtml(assignment.description)}</p>` : ''}

      <div class="card-meta-row">
        <span class="meta-item" title="Due Date">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          ${formattedDueDate}
        </span>

        ${assignment.estimatedMinutes ? `
          <span class="meta-item" title="Estimated Effort">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            ${assignment.estimatedMinutes} mins
          </span>
        ` : ''}
      </div>
    </div>

    <!-- Action Buttons Column -->
    <div class="card-actions-col">
      <button 
        type="button" 
        class="card-action-btn edit-btn" 
        data-action="edit" 
        title="Edit Homework"
        aria-label="Edit assignment"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      </button>

      <button 
        type="button" 
        class="card-action-btn delete-btn" 
        data-action="delete" 
        title="Delete Homework"
        aria-label="Delete assignment"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    </div>
  `;

  return card;
}

/**
 * Escapes HTML characters to prevent XSS.
 */
function escapeHtml(string) {
  if (!string) return '';
  return String(string)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ==========================================================================
   CRUD OPERATIONS (Using DeadlineStorage Data Layer)
   ========================================================================== */

/**
 * Toggles the completed status of an assignment by ID.
 * Calls DeadlineStorage.toggleComplete(id).
 */
async function toggleAssignmentCompleted(id) {
  try {
    const updated = await DeadlineStorage.toggleComplete(id);

    // Refresh state and update UI
    assignments = await DeadlineStorage.getAll();
    updateDashboardStats();
    renderAssignments();

    if (updated.completed) {
      showToast(`Great job! Completed "${updated.title}"`, 'success');
    } else {
      showToast(`Marked "${updated.title}" as pending`, 'info');
    }
  } catch (error) {
    console.error('[DeadlineHub] Toggle error:', error);
    showToast(error.message || 'Failed to update assignment', 'danger');
  }
}

/**
 * Opens modal for adding new homework or editing existing homework.
 */
function openHomeworkModal(editId = null) {
  clearFormValidation();

  if (editId) {
    // Edit existing
    const item = assignments.find(a => a.id === editId);
    if (!item) return;

    DOM.modalTitle.textContent = 'Edit Homework';
    DOM.saveBtnText.textContent = 'Update Homework';
    DOM.editHomeworkId.value = item.id;
    DOM.homeworkSubject.value = item.subject;
    DOM.homeworkTitle.value = item.title;
    DOM.homeworkDescription.value = item.description || '';
    DOM.homeworkDueDate.value = item.dueDate;
    DOM.homeworkDueTime.value = item.dueTime || '23:59';
    DOM.homeworkPriority.value = item.priority || 'medium';
    DOM.homeworkEstimatedTime.value = item.estimatedMinutes || '';
  } else {
    // Add new
    DOM.modalTitle.textContent = 'Add New Homework';
    DOM.saveBtnText.textContent = 'Save Assignment';
    DOM.homeworkForm.reset();
    DOM.editHomeworkId.value = '';

    // Default due date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    DOM.homeworkDueDate.value = tomorrow.toISOString().split('T')[0];
    DOM.homeworkDueTime.value = '23:59';
    DOM.homeworkPriority.value = 'medium';
  }

  DOM.homeworkModal.classList.remove('hidden');
  DOM.homeworkSubject.focus();
}

/**
 * Closes the modal.
 */
function closeHomeworkModal() {
  DOM.homeworkModal.classList.add('hidden');
  DOM.homeworkForm.reset();
  DOM.editHomeworkId.value = '';
  clearFormValidation();
}

/**
 * Clears form error states.
 */
function clearFormValidation() {
  const errorGroups = DOM.homeworkForm.querySelectorAll('.form-group.has-error');
  errorGroups.forEach(group => group.classList.remove('has-error'));
}

/**
 * Validates the modal form.
 */
function validateHomeworkForm() {
  let isValid = true;
  clearFormValidation();

  const subject = DOM.homeworkSubject.value.trim();
  const title = DOM.homeworkTitle.value.trim();
  const dueDate = DOM.homeworkDueDate.value;

  if (!subject) {
    DOM.homeworkSubject.closest('.form-group').classList.add('has-error');
    isValid = false;
  }

  if (!title) {
    DOM.homeworkTitle.closest('.form-group').classList.add('has-error');
    isValid = false;
  }

  if (!dueDate) {
    DOM.homeworkDueDate.closest('.form-group').classList.add('has-error');
    isValid = false;
  }

  return isValid;
}

/**
 * Handles form submission (Save or Update).
 * Delegates persistence to DeadlineStorage.create() or DeadlineStorage.update().
 */
async function handleHomeworkFormSubmit(event) {
  event.preventDefault();

  if (!validateHomeworkForm()) {
    return;
  }

  const editId = DOM.editHomeworkId.value;
  const subject = DOM.homeworkSubject.value.trim();
  const title = DOM.homeworkTitle.value.trim();
  const description = DOM.homeworkDescription.value.trim();
  const dueDate = DOM.homeworkDueDate.value;
  const dueTime = DOM.homeworkDueTime.value || '23:59';
  const priority = DOM.homeworkPriority.value;
  const estimatedMinutes = DOM.homeworkEstimatedTime.value ? parseInt(DOM.homeworkEstimatedTime.value, 10) : null;

  try {
    if (editId) {
      // Update existing assignment via storage layer
      await DeadlineStorage.update(editId, {
        subject,
        title,
        description,
        dueDate,
        dueTime,
        priority,
        estimatedMinutes
      });
      showToast('Assignment updated successfully', 'success');
    } else {
      // Create new assignment via storage layer
      await DeadlineStorage.create({
        subject,
        title,
        description,
        dueDate,
        dueTime,
        priority,
        estimatedMinutes
      });
      showToast('New homework added!', 'success');
    }

    // Refresh state from storage layer and re-render dashboard
    assignments = await DeadlineStorage.getAll();
    updateDashboardStats();
    updateSubjectDropdown();
    renderAssignments();
    closeHomeworkModal();
  } catch (error) {
    console.error('[DeadlineHub] Form submit error:', error);
    showToast(error.message || 'Failed to save homework', 'danger');
  }
}

/**
 * Initiates the delete confirmation dialog.
 */
function promptDeleteAssignment(id) {
  const target = assignments.find(a => a.id === id);
  if (!target) return;

  pendingDeleteId = id;
  DOM.deleteModalText.textContent = `Are you sure you want to delete "${target.title}"?`;
  DOM.deleteModal.classList.remove('hidden');
}

/**
 * Confirms and executes assignment deletion via DeadlineStorage.delete(id).
 */
async function confirmDeleteAssignment() {
  if (!pendingDeleteId) return;

  try {
    const deleted = await DeadlineStorage.delete(pendingDeleteId);
    pendingDeleteId = null;

    // Refresh state from storage layer and re-render dashboard
    assignments = await DeadlineStorage.getAll();
    updateDashboardStats();
    updateSubjectDropdown();
    renderAssignments();
    closeDeleteModal();

    showToast(`Deleted "${deleted.title}"`, 'danger');
  } catch (error) {
    console.error('[DeadlineHub] Delete error:', error);
    showToast(error.message || 'Failed to delete assignment', 'danger');
  }
}

function closeDeleteModal() {
  DOM.deleteModal.classList.add('hidden');
  pendingDeleteId = null;
}

/* ==========================================================================
   TOAST NOTIFICATIONS
   ========================================================================== */

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let iconSvg = '';
  if (type === 'success') {
    iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  } else if (type === 'danger') {
    iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
  } else {
    iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
  }

  toast.innerHTML = `${iconSvg} <span>${escapeHtml(message)}</span>`;
  DOM.toastContainer.appendChild(toast);

  // Auto remove after 3 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 3000);
}

/* ==========================================================================
   THEME (DARK / LIGHT MODE)
   ========================================================================== */

function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
  }
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem(THEME_KEY, newTheme);
  showToast(`Switched to ${newTheme} mode`, 'info');
}

/* ==========================================================================
   DATA EXPORT & RESET (Calling DeadlineStorage)
   ========================================================================== */

function exportDataAsJson() {
  const jsonString = DeadlineStorage.exportJson();
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(jsonString);
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `deadlinehub_backup_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('Assignments exported as JSON file', 'success');
}

async function resetToSampleData() {
  if (confirm('Replace your current homework list with the sample assignments?')) {
    try {
      assignments = await DeadlineStorage.resetToSample();
      updateDashboardStats();
      updateSubjectDropdown();
      renderAssignments();
      showToast('Loaded sample homework data', 'info');
    } catch (error) {
      console.error('[DeadlineHub] Reset error:', error);
      showToast('Failed to reset sample data', 'danger');
    }
  }
}

async function clearAllData() {
  if (confirm('Are you sure you want to delete ALL assignments? This will completely clear your dashboard.')) {
    try {
      assignments = await DeadlineStorage.clearAll();
      updateDashboardStats();
      updateSubjectDropdown();
      renderAssignments();
      showToast('All homework data cleared', 'danger');
    } catch (error) {
      console.error('[DeadlineHub] Clear error:', error);
      showToast('Failed to clear assignments', 'danger');
    }
  }
}

/* ==========================================================================
   EVENT LISTENERS & BINDINGS
   ========================================================================== */

function setupEventListeners() {
  // Theme Toggle
  DOM.themeToggleBtn.addEventListener('click', toggleTheme);

  // Modal Open/Close
  DOM.openModalBtn.addEventListener('click', () => openHomeworkModal());
  DOM.closeModalBtn.addEventListener('click', closeHomeworkModal);
  DOM.cancelModalBtn.addEventListener('click', closeHomeworkModal);
  DOM.emptyAddBtn.addEventListener('click', () => openHomeworkModal());

  // Close modal on click outside
  DOM.homeworkModal.addEventListener('click', (e) => {
    if (e.target === DOM.homeworkModal) closeHomeworkModal();
  });

  // Homework Form Submit
  DOM.homeworkForm.addEventListener('submit', handleHomeworkFormSubmit);

  // Delete Modal Events
  DOM.closeDeleteModalBtn.addEventListener('click', closeDeleteModal);
  DOM.cancelDeleteBtn.addEventListener('click', closeDeleteModal);
  DOM.confirmDeleteBtn.addEventListener('click', confirmDeleteAssignment);
  DOM.deleteModal.addEventListener('click', (e) => {
    if (e.target === DOM.deleteModal) closeDeleteModal();
  });

  // Delegated clicks inside Deadlines List (Checkbox toggle, Edit, Delete)
  DOM.deadlinesList.addEventListener('click', (event) => {
    const card = event.target.closest('.homework-card');
    if (!card) return;
    const assignmentId = card.getAttribute('data-id');

    // Toggle complete
    const toggleBtn = event.target.closest('[data-action="toggle-complete"]');
    if (toggleBtn) {
      toggleAssignmentCompleted(assignmentId);
      return;
    }

    // Edit button
    const editBtn = event.target.closest('[data-action="edit"]');
    if (editBtn) {
      openHomeworkModal(assignmentId);
      return;
    }

    // Delete button
    const deleteBtn = event.target.closest('[data-action="delete"]');
    if (deleteBtn) {
      promptDeleteAssignment(assignmentId);
      return;
    }
  });

  // Filter Tabs
  DOM.filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      DOM.filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.getAttribute('data-filter');
      renderAssignments();
    });
  });

  // KPI Stat Cards Click to Filter
  DOM.statCards.forEach(card => {
    card.addEventListener('click', () => {
      const filterTarget = card.getAttribute('data-filter-target');
      currentFilter = filterTarget;

      DOM.filterTabs.forEach(t => {
        if (t.getAttribute('data-filter') === filterTarget) {
          t.classList.add('active');
        } else {
          t.classList.remove('active');
        }
      });

      renderAssignments();
    });
  });

  // Search Input
  DOM.searchInput.addEventListener('input', (e) => {
    currentSearch = e.target.value.trim();
    if (currentSearch.length > 0) {
      DOM.clearSearchBtn.classList.add('visible');
    } else {
      DOM.clearSearchBtn.classList.remove('visible');
    }
    renderAssignments();
  });

  DOM.clearSearchBtn.addEventListener('click', () => {
    DOM.searchInput.value = '';
    currentSearch = '';
    DOM.clearSearchBtn.classList.remove('visible');
    renderAssignments();
    DOM.searchInput.focus();
  });

  // Subject Dropdown Filter
  DOM.subjectFilterSelect.addEventListener('change', (e) => {
    currentSubjectFilter = e.target.value;
    renderAssignments();
  });

  // Sort By Select
  DOM.sortBySelect.addEventListener('change', (e) => {
    currentSort = e.target.value;
    renderAssignments();
  });

  // Sample data / Reset buttons
  DOM.resetSampleDataBtn.addEventListener('click', resetToSampleData);
  DOM.restoreSampleBtn.addEventListener('click', resetToSampleData);
  DOM.backupDataBtn.addEventListener('click', exportDataAsJson);
  DOM.clearAllBtn.addEventListener('click', clearAllData);

  // Keyboard shortcut: Escape to close modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!DOM.homeworkModal.classList.contains('hidden')) {
        closeHomeworkModal();
      }
      if (!DOM.deleteModal.classList.contains('hidden')) {
        closeDeleteModal();
      }
    }
  });
}

/* ==========================================================================
   APP STARTUP
   ========================================================================== */

async function initApp() {
  initTheme();