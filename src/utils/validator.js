const validator = require("validator");

/**
 * Validates the registration data provided by the user
 * @param {Object} data - The req.body object containing user details
 */
const validate = (data) => {
    // 1. Check for missing mandatory fields
    const MandatoryFields = [
        "firstName", 
        "emailId", 
        "password"
    ];

    const IsAllowed = MandatoryFields.every((k) => 
        Object.keys(data).includes(k)
    );

    if (!IsAllowed) {
        throw new Error("Missing mandatory fields: firstName, emailId, and password are required");
    }

    // 2. Validate Email Format
    if (!validator.isEmail(data.emailId)) {
        throw new Error("Invalid email format provided");
    }

    // 3. Validate Password Strength
    // (Requires min 8 chars, 1 uppercase, 1 number, 1 symbol)
    if (!validator.isStrongPassword(data.password)) {
        throw new Error("Password is not strong enough. It must include uppercase, numbers, and symbols.");
    }
};

module.exports = validate;