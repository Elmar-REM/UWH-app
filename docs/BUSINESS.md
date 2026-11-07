# Business plan: UWH Tactics at $5 a month

## Plans

| | Free | Coach |
| :--- | :--- | :--- |
| Price | $0 | $5 per month |
| Tactics board, animation, automations | Yes | Yes |
| Saved plays | 3, on one device | Unlimited, synced to the account |
| Share links | Yes | Yes |
| Video export | With a small watermark | Clean HD |

The free plan is generous on purpose: every shared link and every watermarked video is an advert to other clubs.

## What it costs to run

* Hosting the website: free (Cloudflare Pages, Netlify or Vercel).
* Supabase: free for up to 50,000 monthly users and 500 MB of database. A play is about 10 to 30 KB, so the free tier holds tens of thousands of plays. The paid tier is $25 a month when you outgrow it.
* Stripe: about 2.9% plus 30 cents per payment in most countries, so a $5 payment leaves about $4.55.
* Domain name: about $10 to $15 a year.

So the first paying coach covers the domain, and around 6 coaches cover the paid Supabase tier if you ever need it.

## Ideas to consider

* **Yearly plan** at $50 per year (two months free). Fewer card fees and fewer cancellations.
* **Club plan** at around $25 a month for up to 10 coaches with a shared playbook.
* **Federation and tournament partners**: give national federations free club plans in exchange for promotion.
* Charge in local currency through Stripe so coaches in Europe, South Africa, Australia and New Zealand see familiar prices.

## Next features worth building

1. Team playbooks shared between coaches of the same club.
2. A read only "player view" so players can study plays on their phones before training.
3. Side view showing depth, for teaching surface and dive timing.
4. Puck carry: attach the puck to a player's stick so it follows them automatically.
5. Drawing curved runs instead of straight lines.
6. Templates library from experienced coaches.
