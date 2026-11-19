-- Rebrand the seeded hosted challenge without changing its participant records,
-- judging state, prizes, discount redemptions or publication status.

BEGIN;

UPDATE challenges
SET
  slug = 'ventureroom-challenge',
  title = 'VentureRoom Challenge',
  organizer = 'VentureRoom',
  description = E'The VentureRoom Challenge gives startup founders an opportunity to strengthen their pitching skills, showcase their businesses, and compete for cash prizes.\n\nPractise with AI investor simulations, improve your pitch readiness, publish your business profile, and share your progress.',
  website_url = 'https://ventureroom.vercel.app',
  eligibility = E'Open to startup founders everywhere. You do not need to be part of Akwa Ibom Tech Week or any other programme.\n- You must be 18 or older.\n- You enter with a business you own or manage (owner or admin) in your VentureRoom workspace.\n- One entry per founder, and each business can be entered once.\n- You need an active, paid Pro Founder plan during the challenge.',
  judging_criteria = E'Entries that meet every requirement are judged on two parts:\n- Pitch performance (60%): your highest verified readiness score from a complete AI investor session during the challenge, taken from VentureRoom''s own report. Screenshots are supporting evidence only.\n- Business profile (40%): how complete and clear your business profile is: the problem, the solution, the target market, the business model, and your traction or supporting information.\nThe highest combined scores win, after verification.',
  terms = E'1. Organiser. The VentureRoom Challenge is run by VentureRoom (https://ventureroom.vercel.app).\n2. Entry period. Entries are accepted from the start date to the submission deadline shown on the challenge page, in West Africa Time.\n3. How to enter. Follow every step on the challenge page and submit your entry on VentureRoom before the deadline.\n4. Scores. Only the score in VentureRoom''s own report counts. Edited or fabricated screenshots lead to disqualification.\n5. Judging. Entries are judged as described in the judging criteria, with the published weights.\n6. Prizes. 1st place NGN 100,000; 2nd place NGN 60,000; 3rd place NGN 40,000. One prize per founder and per business. Winners are contacted by email and paid by bank transfer after VentureRoom confirms their identity and eligibility.\n7. Announcement. Winners are announced through VentureRoom''s official channels. VentureRoom may publish winners'' business names and profile links; founders'' names only with their permission.\n8. Subscription. The Pro Founder plan is a normal paid plan under VentureRoom''s Terms of Service and Refund Policy. The discount code applies to the first monthly payment only. A refunded payment ends the access it bought, and the entry may then no longer qualify.\n9. Social platforms. This challenge is not sponsored, endorsed or administered by, or associated with, Instagram, Facebook or X. By entering you release them from any liability connected with it.\n10. Disqualification. VentureRoom may disqualify entries that break these terms, use manipulated evidence or misrepresent a business, and records the reason.\n11. Changes. VentureRoom may change or cancel the challenge if it must; any change is posted on the challenge page.\n12. Privacy. Entry data is handled under VentureRoom''s Privacy Policy.',
  social_handles = '{}'::jsonb
WHERE slug = 'pitchnest-challenge';

UPDATE discount_codes
SET description = 'VentureRoom Challenge: 50% off the first month of Pro Founder'
WHERE code = 'PCHU01'
  AND description LIKE 'PitchNest Challenge:%';

INSERT INTO schema_migrations (version, description)
VALUES ('0041', 'Rebrand hosted challenge and public slug for VentureRoom')
ON CONFLICT (version) DO NOTHING;

COMMIT;
