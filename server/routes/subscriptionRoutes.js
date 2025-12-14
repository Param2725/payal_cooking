const express = require('express');
const router = express.Router();
const {
    buySubscription,
    verifySubscriptionPayment,
    cancelSubscription,
    renewSubscription,
    verifyRenewal,
    getMySubscription,
} = require('../controllers/subscriptionController');
const { protect } = require('../middleware/authMiddleware');

router.route('/').post(protect, buySubscription);
router.route('/verify').post(protect, verifySubscriptionPayment);
router.route('/cancel').post(protect, cancelSubscription);
router.route('/renew-init').post(protect, renewSubscription);
router.route('/renew-verify').post(protect, verifyRenewal);
router.route('/me').get(protect, getMySubscription);

module.exports = router;
