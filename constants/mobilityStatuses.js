/*constants/mobilityStatuses.js
    this file contains the list of valid client mobilityStatus values,
    which can be used in other parts of the application to ensure consistency and avoid hardcoding status values in multiple places.
    Referenced by both the Mongoose schema (Client.js ) So they can never drift out of sync.
    Add a new status here Once.
*/
const MOBILITY_STATUSES = ["Independent", "Assisted", "Hoisted", "Wheelchair-bound", "Bedridden", "Other"];

module.exports = {MOBILITY_STATUSES};