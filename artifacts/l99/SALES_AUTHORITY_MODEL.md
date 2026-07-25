# L99 Sales Authority Model

States:

`observed → qualified → offer_draft → devil_reviewed → founder_approved → published → checkout_started → paid → fulfilled → retained | refunded | stopped`

No state authorizes the next. Separate founder gates govern catalog, price and discounts, public claims, communication, analytics, checkout and payment, customer data, domains, deployment, refunds, and rollback.

Evidence binds project, exact catalog and offer version, approved public facts, owner, environment, timestamp, proof, and next gate. Private vendors, costs, customer exports, admin data, credentials, and strategy stay outside public evidence.

Ambiguous payment, deployment, fulfillment, or duplicate action fails closed and is reconciled before retry.