/**
 * ============================================================================
 * DeadlineHub — Data Access & Storage Layer (storage.js)
 * ============================================================================
 * 
 * ARCHITECTURE OVERVIEW:
 * This file serves as the "Data Access Layer" (or Repository) for DeadlineHub.
 * It isolates ALL database and persistence operations away from the user interface
 * (HTML and script.js).
 * 
 * WHY IS THIS IMPORTANT FOR CLOUD INTEGRATION (e.g. Supabase / Firebase / REST)?
 * 1. Separation of Concerns: The UI (script.js) only asks for data and receives it.
 *    It does not know or care whether the data came from localStorage, Supabase,
 *    Firebase, or a custom API.
 * 2. Asynchronous API (Promises / async-await): Cloud databases communicate over
 *    the network and are asynchronous. By making all our storage methods async
 *    (returning Promises), we can later swap the internal localStorage logic with
 *    Supabase database queries (e.g. `supabase.from('assignments').insert(...)`)
 *    WITHOUT having to rewrite our UI code!
 * 3. Backward Compatibility: We use the exact same localStorage key
 *    (`deadlinehub_assignments_v1`) so all your existing saved assignments
 *    remain 100% intact!
 * ============================================================================
 */

(function (window) {
  'use strict';

  // Primary localStorage keys
  const STORAGE_KEY = 'deadlinehub_assignments_v1';
  const THEME_KEY = 'deadlinehub_theme';

  /**
   * Helper: Generates realistic sample assignments with dates relative to today.
   * This is only used when localStorage is completely empty on initial launch,
   * or when the user clicks "Load Sample Data".
   */
  function generateSeedAssignments() {
    const now = new Date();

    const formatIsoDate = (d) => d.toISOString().split('T')[0];

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    const today = new Date(now);

    const inTwoDays = new Date(now);
    inTwoDays.setDate(now.getDate() + 2);

    const inFiveDays = new Date(now);
    inFiveDays.setDate(now.getDate() + 5);

    return [
      {
        id: 'demo-1',
        subject: 'Mathematics',
        title: 'Calculus: Derivatives Problem Set',
        description: 'Complete problems 14 through 32 on page 184. Show step-by-step working for chain rule questions.',
        dueDate: formatIsoDate(yesterday),
        dueTime: '17:00',
        priority: 'high',
        estimatedMinutes: 60,
        completed: false,
        createdAt: new Date(now.getTime() - 86400000 * 3).toISOString()
      },
      {
        id: 'demo-2',
        subject: 'Computer Science',
        title: 'Build DeadlineHub Web App',
        description: 'Create an interactive student homework dashboard using pure HTML, CSS, and JavaScript with localStorage.',
        dueDate: formatIsoDate(today),
        dueTime: '23:59',
        priority: 'high',
        estimatedMinutes: 120,
        completed: false,
        createdAt: new Date(now.getTime() - 86400000 * 2).toISOString()
      },
      {
        id: 'demo-3',
        subject: 'Physics',
        title: 'Lab Report: Pendulum Oscillation',
        description: 'Type up observations, plot frequency vs. length graph in Excel/Sheets, and answer conclusion questions.',
        dueDate: formatIsoDate(inTwoDays),
        dueTime: '14:30',
        priority: 'medium',
        estimatedMinutes: 90,
        completed: false,
        createdAt: new Date(now.getTime() - 86400000 * 1).toISOString()
      },
      {
        id: 'demo-4',
        subject: 'English Literature',
        title: 'Read Chapters 4-6 of To Kill a Mockingbird',
        description: 'Take character notes on Atticus Finch and highlight key thematic quotes regarding justice.',
        dueDate: formatIsoDate(inFiveDays),
        dueTime: '09:00',
        priority: 'low',
        estimatedMinutes: 45,
        completed: true,
        createdAt: new Date(now.getTime() - 86400000 * 4).toISOString()
      }
    ];
  }

  /**
   * Internal Helper: Reads assignments from browser localStorage.
   * If this is the user's first time visiting (key is null), automatically seeds sample data.
   */
  function _readRawFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) {
        const seed = generateSeedAssignments();
        _writeRawToStorage(seed);
        return seed;
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error('[DeadlineStorage] Error reading from localStorage:', err);
      return [];
    }
  }

  /**
   * Internal Helper: Writes assignments array to browser localStorage.
   */
  function _writeRawToStorage(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (err) {
      console.error('[DeadlineStorage] Error writing to localStorage:', err);
      throw new Error('Storage write failed. Your browser storage might be full.');
    }
  }

  /**
   * DeadlineStorage Object:
   * Contains reusable data operations for assignments.
   * Every method returns a Promise to simulate an asynchronous cloud database.
   */
  const DeadlineStorage = {
    STORAGE_KEY: STORAGE_KEY,
    THEME_KEY: THEME_KEY,

    /**
     * FETCH ALL ASSIGNMENTS
     * Retrieves all assignments from storage.
     * Future cloud equivalent:
     *   const { data, error } = await supabase.from('assignments').select('*');
     * @returns {Promise<Array>} List of assignments
     */
    async getAll() {
      const items = _readRawFromStorage();
      return Promise.resolve(items);
    },

    /**
     * GET SINGLE ASSIGNMENT BY ID
     * Retrieves a single assignment matching the given ID.
     * Future cloud equivalent:
     *   const { data } = await supabase.from('assignments').select('*').eq('id', id).single();
     * @param {string} id - Assignment ID
     * @returns {Promise<Object|null>} Assignment object or null if not found
     */
    async getById(id) {
      const items = _readRawFromStorage();
      const match = items.find(item => item.id === id) || null;
      return Promise.resolve(match ? { ...match } : null);
    },

    /**
     * CREATE NEW ASSIGNMENT
     * Adds a new assignment to storage with a generated unique ID and timestamp.
     * Future cloud equivalent:
     *   const { data } = await supabase.from('assignments').insert([newAssignment]).select();
     * @param {Object} assignmentData - Assignment fields { subject, title, description, dueDate, dueTime, priority, estimatedMinutes }
     * @returns {Promise<Object>} Newly created assignment
     */
    async create(assignmentData) {
      if (!assignmentData.subject || !assignmentData.title || !assignmentData.dueDate) {
        return Promise.reject(new Error('Subject, title, and due date are required.'));
      }

      const items = _readRawFromStorage();

      const newAssignment = {
        id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        subject: String(assignmentData.subject).trim(),
        title: String(assignmentData.title).trim(),
        description: assignmentData.description ? String(assignmentData.description).trim() : '',
        dueDate: assignmentData.dueDate,
        dueTime: assignmentData.dueTime || '23:59',
        priority: assignmentData.priority || 'medium',
        estimatedMinutes: assignmentData.estimatedMinutes ? parseInt(assignmentData.estimatedMinutes, 10) : null,
        completed: false,
        createdAt: new Date().toISOString()
      };

      // Put new assignment at the beginning of the list
      items.unshift(newAssignment);
      _writeRawToStorage(items);

      return Promise.resolve(newAssignment);
    },

    /**
     * UPDATE EXISTING ASSIGNMENT
     * Updates an existing assignment by its unique ID.
     * Future cloud equivalent:
     *   const { data } = await supabase.from('assignments').update(updates).eq('id', id).select();
     * @param {string} id - Assignment ID to update
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} The updated assignment
     */
    async update(id, updates) {
      const items = _readRawFromStorage();
      const index = items.findIndex(item => item.id === id);

      if (index === -1) {
        return Promise.reject(new Error(`Assignment with ID "${id}" was not found.`));
      }

      // Merge existing data with updates, preserving id and createdAt
      const updatedItem = {
        ...items[index],
        ...updates,
        id: items[index].id,
        createdAt: items[index].createdAt
      };

      // Clean string inputs
      if (updates.subject !== undefined) updatedItem.subject = String(updates.subject).trim();
      if (updates.title !== undefined) updatedItem.title = String(updates.title).trim();
      if (updates.description !== undefined) updatedItem.description = String(updates.description).trim();
      if (updates.estimatedMinutes !== undefined) {
        updatedItem.estimatedMinutes = updates.estimatedMinutes ? parseInt(updates.estimatedMinutes, 10) : null;
      }

      items[index] = updatedItem;
      _writeRawToStorage(items);

      return Promise.resolve(updatedItem);
    },

    /**
     * TOGGLE COMPLETION STATUS
     * Flips the completed boolean of an assignment.
     * Future cloud equivalent:
     *   await supabase.from('assignments').update({ completed: !curr }).eq('id', id);
     * @param {string} id - Assignment ID
     * @returns {Promise<Object>} The updated assignment
     */
    async toggleComplete(id) {
      const items = _readRawFromStorage();
      const target = items.find(item => item.id === id);

      if (!target) {
        return Promise.reject(new Error(`Assignment with ID "${id}" was not found.`));
      }

      target.completed = !target.completed;
      _writeRawToStorage(items);

      return Promise.resolve({ ...target });
    },

    /**
     * DELETE ASSIGNMENT
     * Permanently removes an assignment by its unique ID.
     * Future cloud equivalent:
     *   await supabase.from('assignments').delete().eq('id', id);
     * @param {string} id - Assignment ID to delete
     * @returns {Promise<Object>} The deleted assignment item
     */
    async delete(id) {
      const items = _readRawFromStorage();
      const target = items.find(item => item.id === id);

      if (!target) {
        return Promise.reject(new Error(`Assignment with ID "${id}" was not found.`));
      }

      const filtered = items.filter(item => item.id !== id);
      _writeRawToStorage(filtered);

      return Promise.resolve(target);
    },

    /**
     * RESET TO SAMPLE DATA
     * Replaces current assignments with fresh sample assignments.
     * Useful for beginners testing the dashboard features.
     * @returns {Promise<Array>} The newly loaded sample assignments
     */
    async resetToSample() {
      const freshSample = generateSeedAssignments();
      _writeRawToStorage(freshSample);
      return Promise.resolve(freshSample);
    },

    /**
     * CLEAR ALL ASSIGNMENTS
     * Empties the assignments list completely.
     * @returns {Promise<Array>} Empty array []
     */
    async clearAll() {
      _writeRawToStorage([]);
      return Promise.resolve([]);
    },

    /**
     * EXPORT DATA AS JSON STRING
     * Generates a formatted JSON string of all assignments for backup.
     * @returns {string} Formatted JSON string
     */
    exportJson() {
      const items = _readRawFromStorage();
      return JSON.stringify(items, null, 2);
    }
  };

  // Expose DeadlineStorage to the global window scope
  window.DeadlineStorage = DeadlineStorage;

})(typeof window !== 'undefined' ? window : this);