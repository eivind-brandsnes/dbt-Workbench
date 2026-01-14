{{ config(materialized='table') }}

select *
from (
    values
        (5001, 1001, date '2026-01-11', 'credit_card', 120.00),
        (5002, 1002, date '2026-01-12', 'bank_transfer', 89.50),
        (5003, 1003, date '2026-01-13', 'credit_card', 42.25)
) as raw_payments(payment_id, order_id, payment_date, payment_method, amount)
