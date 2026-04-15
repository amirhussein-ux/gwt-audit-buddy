/**
 * MANUAL ACCOUNT INSERTION REFERENCE
 * 
 * Pre-made accounts are manually added to MongoDB (not auto-seeded).
 * 
 * See MANUAL_ACCOUNT_SETUP.md for complete MongoDB insertion instructions.
 * 
 * Account Format:
 * - Email: username@dict.gov.ph
 * - Default Password: changeme123
 * - Roles: admin, auditor, viewer
 * 
 * To manually insert accounts:
 * 1. Connect to MongoDB directly
 * 2. Use the insertion commands in MANUAL_ACCOUNT_SETUP.md
 * 3. Or use MongoDB Compass/Atlas UI to insert documents
 * 
 * Example MongoDB Document Structure:
 * {
 *   "username": "admin",
 *   "email": "admin@dict.gov.ph",
 *   "hashedPassword": "[hashed]",  // Will be hashed on save via User model
 *   "role": "admin",
 *   "isActive": true,
 *   "loginAttempts": 0,
 *   "createdAt": ISODate,
 *   "updatedAt": ISODate
 * }
 * 
 * Password Hashing:
 * - Passwords are automatically hashed via User.js pre-save middleware
 * - Plain text passwords can be inserted; they will be hashed on first use
 * - Never store plain text passwords directly
 */

console.log('ℹ️  Pre-made accounts are managed manually via MongoDB.');
console.log('📖 See MANUAL_ACCOUNT_SETUP.md for insertion instructions.');
console.log('📖 See PRE_MADE_ACCOUNTS.md for account list and credentials.');
