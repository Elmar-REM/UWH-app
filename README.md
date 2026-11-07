# UWH Tactics

A tactics board for underwater hockey coaches. Plan formations, breathing rotations and set plays on a scale model of the pool, animate them, then share them as a link or download them as a video.

## What it does

* **Accurate pool.** 25 m by 12 m by default, adjustable from 15 to 30 m long and 8 to 18 m wide. 3 m goal trays at each end, centre line, quarter lines and a 1 m grid. Sub boxes on the left or right side.
* **Six a side, ten in the squad.** White and Black teams with caps numbered 1 to 10. Six in the water, four in the sub box. Drag a player in or out of the sub box to make a substitution. The counter turns red if a team has more than six in the water.
* **Real body shapes.** Players are drawn from above at true scale (body, fins, head, snorkel) with the stick and an orange glove on the stick hand, so you can see left and right handers at a glance. Switch to simple discs if you prefer. A size slider makes them bigger or smaller.
* **Up and down.** Each player is either down on the bottom or up for air. Players at the surface are drawn faded with a ring and an UP tag. Double click a player or press U to switch.
* **Facing and body position.** Drag the yellow handle to turn a player, or press Q and E. With "Face direction of travel" on, players automatically turn to face where they are swimming.
* **Frames and animation.** Each frame is a step of the play. Add frames, move the players, press Play. Movement, turning and going up or down are all animated smoothly.
* **Player profiles.** Name, cap number, position, stick hand, speed (slow, medium, fast), breath hold and notes on strengths.
* **Reality check.** The app warns when a move is faster than that player can swim, or when a player stays down longer than their breath hold, or when a team has more than six in the water.
* **Automations.**
  * Start of play: builds the whole sequence from both teams on the wall to the sprint and first contact. The team with the faster centre forward wins the puck.
  * Breathing rotation: adds frames where a team goes up for air in pairs, so four players always stay on the bottom.
  * Auto timing: sets every frame's time from the distance each player swims and their speed, including the time to surface and dive in the pool depth.
  * Mirror: flips a play left to right.
* **Formations.** Start of play on the wall, 3 forwards and 3 backs, 3 forwards 1 half 2 backs, 2 2 2, and a defensive shape.
* **Arrows** in five colours for passes and runs, per frame.
* **Save and share.** Library of saved plays, share links that contain the whole play (nothing to upload), import and export as a file, picture of a frame, and video export (MP4 where the browser supports it, otherwise WebM) in wide 1920 x 1080 or phone 1080 x 1920.
* **Works on phones and tablets.** The pool turns tall on a phone, panels slide in.

## Run it

```
npm install
npm run dev
```

Open the address it prints. Without any keys the app runs in **local mode**: everything is unlocked and plays are saved in the browser.

```
npm run build      # production build in dist/
```

The build is a static site. Host `dist/` anywhere: Cloudflare Pages, Netlify, Vercel or GitHub Pages all work for free.

## Turning on accounts and the $5 a month plan

Accounts and payments use Supabase (login and database) and Stripe (subscriptions). Both have free tiers, so it costs nothing to start.

1. **Supabase.** Create a project at supabase.com. In the SQL editor, run `supabase/migrations/001_init.sql`. Under Authentication, turn on Email and set the Site URL to your website address.
2. **Stripe.** Create a product called "Coach" with a recurring price of $5 per month. Copy the price id (starts with `price_`). Turn on the customer portal under Billing settings.
3. **Edge functions.** With the Supabase CLI:
   ```
   supabase link --project-ref YOUR_PROJECT
   supabase secrets set STRIPE_SECRET_KEY=sk_live_... STRIPE_PRICE_ID=price_... STRIPE_WEBHOOK_SECRET=whsec_...
   supabase functions deploy create_checkout
   supabase functions deploy billing_portal
   supabase functions deploy stripe_webhook --no-verify-jwt
   ```
4. **Webhook.** In Stripe, add a webhook endpoint pointing to `https://YOUR_PROJECT.supabase.co/functions/v1/stripe_webhook` with the events `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated` and `customer.subscription.deleted`. Put its signing secret in `STRIPE_WEBHOOK_SECRET`.
5. **Website.** Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then build and deploy.

Once keys are set the app shows a Free plan (3 saved plays, watermark on videos) and the Coach plan for $5 a month (unlimited plays, saved to the account on every device, clean videos). Users sign in with a link sent to their email, so there are no passwords to manage.

## Project layout

| Path | What is in it |
| :--- | :--- |
| `src/model.ts` | Pool, players, frames, formations, sub boxes |
| `src/animation.ts` | Interpolation between frames, timing and the reality check |
| `src/automations.ts` | Start of play, breathing rotation, auto timing, mirror |
| `src/render.ts` | Drawing the pool and players on a canvas |
| `src/video.ts` | Video and picture export |
| `src/storage.ts` | Library, share links, file export |
| `src/cloud.ts` | Optional accounts, cloud saves and subscription |
| `src/App.tsx` | The editor screen |
| `supabase/` | Database schema and the Stripe functions |
| `docs/` | Research on the sport and the business plan |

## Keyboard

| Key | Action |
| :--- | :--- |
| Space | Play or pause |
| Left, Right | Previous or next frame |
| U | Selected player up or down |
| Q, E | Turn selected player |
| L, R | Stick in left or right hand |
| Ctrl Z, Ctrl Shift Z | Undo, redo |
