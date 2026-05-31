import { Router } from 'express';
import passport from 'passport';
import { config } from '../config';

const router = Router();

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${config.frontendUrl}/login?error=1`,
  }),
  (_req, res) => {
    res.redirect(config.frontendUrl);
  },
);

router.get('/me', (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: 'Nicht angemeldet' });
    return;
  }
  const { id, name, email, picture } = req.user!;
  res.json({ id, name, email, picture });
});

router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      res.status(500).json({ error: 'Fehler beim Abmelden' });
      return;
    }
    res.json({ ok: true });
  });
});

export default router;
