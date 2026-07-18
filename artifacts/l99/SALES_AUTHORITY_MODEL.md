# L99 Sales Authority — Public Hair

States: `observed → qualified → offer_draft → devil_reviewed → founder_approved → published → checkout_started → paid → fulfilled → retained | refunded | stopped`.

No state authorizes the next.

Separate founder gates are required for price/discount changes, catalog changes, public claims, customer communications, analytics changes, checkout/payment changes, domain/DNS changes, deployment, refunds, and rollback.

Evidence binds project, exact catalog/offer version, approved public product facts, checkout authority, environment, decision owner, timestamp, and next gate. Private vendor, cost, customer export, admin, credential, and strategy data must never enter public evidence.

Ambiguous payment, deployment, or duplicate action fails closed and is reconciled before retry.