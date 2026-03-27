const { Router } = require('express');
const school = require('../config/school');

const router = Router();

// ─────────────────────────────────────────────────────────────────
// GET /schools/config
// Public endpoint (no auth required) — returns school branding info
// Used by mobile/web apps to configure UI with school identity
// ─────────────────────────────────────────────────────────────────

router.get('/config', (req, res) => {
  res.json({
    school: {
      name: school.name,
      motto: school.motto,
      address: school.address,
      region: school.region,
      district: school.district,
      phone: school.phone,
      email: school.email,
      logo: school.logo,
    },
  });
});

module.exports = router;
