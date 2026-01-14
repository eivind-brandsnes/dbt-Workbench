{{ config(materialized='table') }}

select *
from (
    values
        (1001, 1, date '2026-01-10', 'placed', 120.00),
        (1002, 2, date '2026-01-11', 'shipped', 89.50),
        (1003, 1, date '2026-01-12', 'delivered', 42.25),
        (1004, 3, date '2026-01-12', 'placed', 15.00)
) as raw_orders(order_id, customer_id, order_date, status, order_amount)
