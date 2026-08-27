# StorePulse — Marketing Kit

Everything needed to market StorePulse, written against what the app **actually
does**. Nothing here claims a capability that isn't built — a merchant who
installs on the strength of a promise the app can't keep churns in a week and
leaves a one-star review, so accuracy here is a growth tactic, not a constraint.

---

## 1. Positioning

**Name:** StorePulse
**Tagline:** Know what needs attention. Every day.

**The one sentence:**
> StorePulse watches your Shopify store and tells you the moment something is
> costing you money — before you find out from a bad week.

### The core insight

Shopify already *has* this data. What it doesn't do is **come find you**.
A merchant checks inventory, orders, refunds and analytics across six screens,
or more realistically doesn't check at all until revenue dips. StorePulse
inverts that: one brief each morning, and an instant alert when something
breaks.

**Sell timeliness, not dashboards.** Every competing "analytics" app sells
charts. Charts are a thing merchants must remember to look at. StorePulse's
product is *arriving*.

### The story that sells it

> Your best seller sold out on Friday night. You found out Monday.
> You lost three days of sales on your top product and never knew why the week
> was bad.

Every merchant who has lived that installs immediately. Lead with it everywhere
— listing, ads, cold emails, landing page. Merchants who *haven't* lived it will
scroll past, and that's fine: they aren't your buyer yet.

### Who to target

| Segment | Why they buy |
| --- | --- |
| D2C stores, ₹5–50L / $10–60k monthly revenue | Big enough to lose real money to a stock-out, too small for an ops team |
| Stores with 50+ SKUs | Cannot eyeball inventory manually |
| Stores with COD (India, SEA, LATAM) | RTO and delayed-order losses are severe and invisible |
| Solo founders and 1–3 person teams | Nobody's full-time job is watching the store |
| Agencies managing client stores | One dashboard per client, alerts by email |

**Who not to target:** stores under ~20 orders/month (nothing to detect,
segments stay empty, they churn), and large merchants with a BI stack.

---

## 2. App Store listing copy

### Short description (under 120 chars)
> Get told the moment a best seller sells out, an order stalls, or refunds
> spike. One brief every morning.

### Long description

**Stop finding out about problems a week late.**

StorePulse watches your store around the clock and sends you one short brief
each morning: what happened, why it matters, and what to do about it. When
something critical breaks, you hear about it within minutes.

**What StorePulse catches**

- 🔴 **Unexpected sold-outs** — a product that was selling normally just hit
  zero. StorePulse knows it was selling 8 a day and tells you what that costs.
- 🔴 **Delayed orders** — orders sitting unfulfilled past 24 hours, with the
  order value at stake and the customer waiting.
- 🟠 **Low stock** — before it becomes a sold-out, at a threshold you set.
- 🟠 **Refund spikes** — today's refund rate against your own 28-day normal, so
  a genuinely unusual day stands out.
- 🟠 **Sales drops** — revenue or order volume falling against the previous
  period, with the products responsible.
- 🟠 **Duplicate products** — the same product added twice, splitting your
  inventory so one listing sells out while the other holds stock.
- 💸 **Profit leaks** — products losing money after returns, discount codes
  destroying margin, shipping zones costing more than you charge.
- 👥 **Customers drifting away** — repeat buyers who have gone quiet, and what
  they were worth.

**How it works**

1. Install — StorePulse scans your store in under a minute
2. See your store health score and everything that needs attention
3. Get one brief each morning, and instant alerts for anything critical

**What makes it different**

Every alert answers three questions: **what happened**, **why it matters**, and
**what to do**. Not "your conversion rate is 2.4%" — but "Black Hoodie Medium is
sold out; it sold 42 units last month, about ₹1,400/day unavailable; restock or
reallocate inventory."

StorePulse is **read-only**. It never changes your products, orders or
inventory, and never contacts your customers.

### Keywords / tags
`inventory alerts`, `stock alerts`, `out of stock`, `order monitoring`,
`profit`, `margin`, `refunds`, `store health`, `daily report`,
`low stock notification`, `unfulfilled orders`, `analytics`

### Screenshots to capture (in order)

1. **Dashboard** — health score, six metric cards, the daily brief
2. **A critical alert** — sold-out product, showing why-it-matters and action
3. **Alert center** — filters and a healthy mix of severities
4. **Profit leaks** — the "Today's 3 actions" block
5. **Daily digest email** — the actual email in an inbox
6. **Customers** — segments with real counts

> Use the demo store (`DEMO_MODE=true`) for screenshots. It has 100 products,
> 500 variants and 50 orders, so every screen looks populated and realistic
> without exposing a real merchant's data.

---

## 3. Pricing

| Plan | Price | The line that sells it |
| --- | --- | --- |
| **Free** | $0 | Daily brief + inventory and order alerts, 7-day alert history |
| **Starter** | $9/mo | **Instant email the moment something breaks** — not tomorrow morning |
| **Growth** | $19/mo | Profit leak detection, product health, 90-day reporting |
| **Pro** | $49/mo | Team notifications, advanced reporting, 365-day history |

### The upgrade argument

Free tells you tomorrow. Starter tells you in minutes. **A sold-out best seller
costs money every hour** — at ₹1,400/day, one overnight stock-out costs more
than a year of Starter.

That argument is built into the product: when a critical alert wasn't emailed
because of the plan, the app shows the merchant exactly what it cost them —
*"Detected at 14:32 — you'll see this in tomorrow's digest."* That prompt is
your highest-converting surface. Don't bury it behind a pricing table.

**Keep Free genuinely useful.** It's your distribution: merchants who get value
free leave reviews, and reviews are how Shopify apps get discovered.

---

## 4. Launch plan

### Week 1 — foundations
- [ ] App Store listing live with all 6 screenshots
- [ ] 60–90 second demo video (install → scan → first alert)
- [ ] Support email on the listing, monitored
- [ ] Ask 5 friendly merchants to install and leave an honest review

### Week 2–4 — first 100 installs
- [ ] **Reddit**: r/shopify, r/ecommerce — post the *problem*, not the app.
      "How do you find out when a product sells out?" Answer honestly, mention
      StorePulse only if asked.
- [ ] **Facebook groups**: Shopify Entrepreneurs, Shopify Ecommerce Growth
- [ ] **Indie Hackers / Product Hunt** launch
- [ ] **Twitter/X**: post real screenshots of alerts (with fake store data)
- [ ] **Cold email** 50 stores you can see are missing stock (below)
- [ ] **Agencies**: offer free Pro to agencies managing 5+ stores

### Ongoing
- [ ] Reviews: ask in-app after a merchant resolves their **third** alert —
      that's the moment the app has demonstrably helped
- [ ] Content: "how much a stock-out actually costs", with real arithmetic
- [ ] Shopify App Store SEO: the keywords above in the listing body

---

## 5. Copy you can reuse

### Cold email

> **Subject:** your [Product Name] is out of stock
>
> Hi [Name],
>
> I was on [store.com] and noticed [Product] is showing sold out — it looks like
> one of your better sellers.
>
> Most store owners find out days later. I built StorePulse because I got tired
> of that: it watches your store and emails you within minutes when a product
> sells out, an order stalls, or refunds spike.
>
> Free plan, installs in a minute: [link]
>
> Either way, worth restocking that one.
>
> [Your name]

Personal, specific, useful even if they ignore the app. **Only send it when the
product genuinely is sold out** — a fake observation destroys trust instantly.

### Social post

> Your best seller sold out Friday night.
> You found out Monday.
> Three days of sales gone — and you never knew why the week was bad.
>
> StorePulse tells you in minutes. Free plan on the Shopify App Store 👇

### Reply template for "how is this different from Shopify's reports?"

> Shopify has the data — you just have to go look for it, across six screens,
> every day. StorePulse comes to you: one brief each morning, and an instant
> alert when something's actually wrong. It also tells you what it costs and
> what to do, which reports don't.

---

## 6. Objection handling

| Objection | Honest answer |
| --- | --- |
| "Shopify already shows low stock" | It shows it if you look. StorePulse tells you *without* looking, and flags a product that was selling well and just stopped — which Shopify doesn't distinguish. |
| "I don't want another email" | It's one email a day, and you set the time. Turn off anything you don't want; in-app alerts still work. |
| "Is my data safe?" | Read-only access, we never change anything, never contact your customers, and every read of customer data is logged and visible to you. Full policy at /privacy. |
| "Will it slow my store down?" | It doesn't touch your storefront at all. No scripts, no theme changes. |
| "Do I need to enter costs?" | Only for profit analysis. Everything else works out of the box. Without costs we say margin is unknown rather than guessing. |
| "What if I have no sales yet?" | Then it'll be quiet — StorePulse needs order history to spot anything unusual. Come back at ~20 orders/month. |

---

## 7. Claims you must NOT make

The app was deliberately built to be honest about its limits. Marketing must
match, or the first technically-minded merchant will call it out publicly.

- ❌ **"AI-powered"** — there is no model in the product. It's rules with real
  thresholds, and that's a better story anyway: it's predictable.
- ❌ **"Increases your revenue by X%"** — unprovable. Say *"surfaces revenue at
  risk"*, which is what the app measures.
- ❌ **"Tracks your ad spend / ROAS"** — Shopify has no ad data. Ad spend is a
  number the merchant types in, used blended.
- ❌ **"Tracks RTO / courier failures"** — not integrated with any courier. RTO
  is a percentage the merchant estimates.
- ❌ **"Real-time analytics"** — webhook-driven alerts are near-instant; metrics
  and reports are computed on a schedule.
- ❌ **"Automatically fixes issues"** — read-only, by design. Say so proudly:
  it's a trust advantage.
- ⚠️ **Profit figures** — always distinguish measured from estimated, exactly as
  the app does. Screenshots should show the Measured/Estimated tags, not crop
  them out.

---

## 8. Metrics to watch

| Metric | Why | Healthy signal |
| --- | --- | --- |
| Install → onboarding completed | Did the first scan work? | > 80% |
| Stores with ≥1 alert in week 1 | Is the app finding anything? | > 70% |
| Alerts resolved or dismissed | Are alerts trusted, or ignored? | > 40% actioned |
| Free → paid conversion | Is timeliness worth $9? | 2–5% |
| 30-day retention | The real verdict | > 50% |
| Uninstalls in first 48h | Usually "found nothing useful" | < 15% |

**The one to watch first:** *stores with at least one alert in week 1*. If a
merchant installs and StorePulse finds nothing, they uninstall — and the fix is
targeting (bigger stores), not more features.

---

## 9. What to build next, based on evidence

Don't guess. The alert resolve/dismiss data tells you which problems merchants
actually care about:

- **Alerts consistently resolved** → that rule is valuable; deepen it
- **Alerts consistently dismissed** → that rule is noise; tune the threshold or
  remove it
- **Alerts ignored entirely** → wrong severity, or the merchant doesn't care

The automation builder (see `docs/automation-builder-brief.md`) is the obvious
next product — but wait until this data tells you *which* automations merchants
would actually want.

---

## 10. Launch checklist

- [ ] Listing live with screenshots and demo video
- [ ] Support email monitored, replies within 24h
- [ ] `/privacy`, `/terms`, `/security` reachable from the listing
- [ ] Demo mode **off** in production (`DEMO_MODE` unset)
- [ ] Daily digest and weekly summary sending correctly from a verified domain
- [ ] DMARC record set so email lands in inboxes, not spam
- [ ] First 5 reviews requested from real installs
- [ ] Analytics on the listing page tracked weekly
