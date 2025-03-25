export declare function addRemoteDBToStore(address: string, peerId: string, name?: string): Promise<boolean>;
/**
 * Switches the application to use a remote OrbitDB database
 *
 * This function performs a complete database switch operation by:
 * 1. Opening the remote settings database using the provided address
 * 2. Adding the database to Voyager for persistence
 * 3. Loading all blog settings (name, description, categories, posts address)
 * 4. Opening the posts database referenced in the settings
 * 5. Loading all posts from the posts database
 * 6. Updating all relevant Svelte stores with the remote data
 *
 * The function implements a retry mechanism that continues attempting to
 * load the database until all required data is successfully retrieved.
 *
 * @param {string} address - The OrbitDB address of the remote settings database to switch to
 * @param {boolean} [showModal=false] - Whether to show a loading modal during the operation
 *
 * @returns {Promise<boolean>} True if the switch was successful, false if it failed
 *
 * @throws {Error} Throws an error if OrbitDB is not initialized
 *
 * @example
 * // Switch to a remote database without showing a modal
 * await switchToRemoteDB('zdpuAywgooGrEcDdAoMsK4umnDZyxY9gMTdjwww29h2B9MKeh/db-name');
 *
 * @example
 * // Switch to a remote database with a loading modal
 * await switchToRemoteDB('zdpuAywgooGrEcDdAoMsK4umnDZyxY9gMTdjwww29h2B9MKeh/db-name', true);
 */
export declare function switchToRemoteDB(address: string, showModal?: boolean): Promise<boolean>;
//# sourceMappingURL=dbUtils.d.ts.map