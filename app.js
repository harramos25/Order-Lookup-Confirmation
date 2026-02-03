/**
 * Client-Side Controller
 * Dito yung pinaka 'glue' code na nag-uugnay sa UI at StorageService natin.
 */

const App = {
    SESSION_KEY: 'cassncase_current_order_id',
    UPDATE_SELECTION_KEY: 'cassncase_update_fields',

    /**
     * Initialize natin yung system.
     */
    init: async function () {
        console.log("App Initializing...");
        try {
            await StorageService.init();
            console.log("App Ready na!");
        } catch (e) {
            console.error("App Init Failed:", e);
            alert("System Error: Storage could not be initialized.");
        }
    },

    /**
     * Hanap tayo ng buyer gamit yung Email o Phone number.
     * @param {string} query - Email o Numero
     * @returns {Promise<object|null>} - Computed Buyer State
     */
    findBuyer: async function (query) {
        return await StorageService.searchBuyer(query);
    },

    /**
     * Simulan na yung session para sa isang buyer.
     */
    startSession: function (buyerId) {
        sessionStorage.setItem(this.SESSION_KEY, buyerId);
    },

    /**
     * Kunin yung buyer na nasa current "session".
     */
    getCurrentBuyer: async function () {
        const buyerId = sessionStorage.getItem(this.SESSION_KEY);
        if (!buyerId) return null;
        return await StorageService.getComputedState(buyerId);
    },

    /**
     * I-log yung action (kung nakapag CONFIRM o may UPDATE).
     */
    logAction: async function (buyerId, action, changes = null) {
        await StorageService.logAction(buyerId, action, changes);
    },

    /**
     * Helper para makuha yung logs (para sa Admin).
     */
    getLogs: async function () {
        // Ito yung para sa dating generic table. 
        // Admin usually diretso sa StorageService, pero keep natin to para safe.
        return await StorageService.getAllLogs();
    },

    // --- Navigation Helpers na gagamitin natin --- //

    setUpdateSelection: function (fields) {
        sessionStorage.setItem(this.UPDATE_SELECTION_KEY, JSON.stringify(fields));
    },

    getUpdateSelection: function () {
        const data = sessionStorage.getItem(this.UPDATE_SELECTION_KEY);
        return data ? JSON.parse(data) : [];
    }
};

// Initialize muna pagka-load ng page
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
