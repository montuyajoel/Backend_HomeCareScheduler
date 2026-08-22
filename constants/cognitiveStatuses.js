/*constants/cognitiveStatuses.js
    this file contains the list of valid client cognitiveStatus values,
    which can be used in other parts of the application to ensure consistency and avoid hardcoding status values in multiple places.
    Referenced by both the Mongoose schema (Client.js ) So they can never drift out of sync.
    Add a new status here Once.
*/
const COGNITIVE_STATUSES = ["Normal", "Mild Cognitive Impairment", "Dementia", "Other"];

module.exports = {COGNITIVE_STATUSES};