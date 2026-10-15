// Pin a timezone with DST so local-date logic (streaks, alarm times) is tested deterministically.
module.exports = async () => {
  process.env.TZ = 'Europe/Berlin';
};
