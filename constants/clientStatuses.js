/*constants/clientStatuses.js
    this file contains the list of valid client statuses, which can be used in other parts of the application to ensure consistency and avoid hardcoding status values in multiple places.
    Referenced by both the Mongoose schema (Client.js and the clientFilter.js utility function for 
    filtering clients based on their status.) So they can never drift out of sync.
    Add a new status here Once.*/
const CLIENT_STATUSES = ["active", "inactive", "deceased", "other"];

module.exports = {CLIENT_STATUSES};