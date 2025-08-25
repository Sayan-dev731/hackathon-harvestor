/**
 * Authentication middleware for admin access control
 */

// Simple admin credentials (in production, use proper authentication with hashed passwords)
const ADMIN_CREDENTIALS = {
    id: process.env.ADMIN_ID || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123'
};

/**
 * Middleware to check admin authentication
 * Expects Authorization header with format: "Basic base64(id:password)"
 */
const authenticateAdmin = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Basic ')) {
            return res.status(401).json({
                error: 'Authentication required',
                message: 'Please provide admin credentials'
            });
        }

        // Extract and decode credentials
        const base64Credentials = authHeader.split(' ')[1];
        const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
        const [id, password] = credentials.split(':');

        // Verify credentials
        if (id !== ADMIN_CREDENTIALS.id || password !== ADMIN_CREDENTIALS.password) {
            return res.status(401).json({
                error: 'Invalid credentials',
                message: 'Incorrect admin ID or password'
            });
        }

        // Authentication successful
        req.admin = { id };
        next();
    } catch (error) {
        return res.status(401).json({
            error: 'Authentication failed',
            message: 'Invalid authorization header format'
        });
    }
};

/**
 * Alternative middleware using query parameters (for easier testing)
 * Use only for development - not secure for production
 */
const authenticateAdminQuery = (req, res, next) => {
    try {
        const { admin_id, admin_password } = req.query;

        if (!admin_id || !admin_password) {
            return res.status(401).json({
                error: 'Authentication required',
                message: 'Please provide admin_id and admin_password parameters'
            });
        }

        // Verify credentials
        if (admin_id !== ADMIN_CREDENTIALS.id || admin_password !== ADMIN_CREDENTIALS.password) {
            return res.status(401).json({
                error: 'Invalid credentials',
                message: 'Incorrect admin ID or password'
            });
        }

        // Authentication successful
        req.admin = { id: admin_id };
        next();
    } catch (error) {
        return res.status(401).json({
            error: 'Authentication failed',
            message: error.message
        });
    }
};

module.exports = {
    authenticateAdmin,
    authenticateAdminQuery
};
