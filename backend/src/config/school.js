/**
 * School identity config — loaded from environment variables.
 * Change these in .env per deployment.
 */
const school = {
  name:     process.env.SCHOOL_NAME     || 'My School',
  motto:    process.env.SCHOOL_MOTTO    || '',
  address:  process.env.SCHOOL_ADDRESS  || '',
  region:   process.env.SCHOOL_REGION   || '',
  district: process.env.SCHOOL_DISTRICT || '',
  phone:    process.env.SCHOOL_PHONE    || '',
  email:    process.env.SCHOOL_EMAIL    || '',
  logo:     process.env.SCHOOL_LOGO     || '/logo.png',
};

module.exports = school;
