with orders as (
    select *
    from {{ ref('stg_orders') }}
),
payments as (
    select *
    from {{ ref('stg_payments') }}
)

select
    orders.order_id,
    orders.customer_id,
    orders.order_date,
    orders.status,
    orders.order_amount,
    coalesce(sum(payments.amount), 0) as payments_total,
    max(payments.payment_date) as last_payment_date
from orders
left join payments
    on orders.order_id = payments.order_id
group by
    orders.order_id,
    orders.customer_id,
    orders.order_date,
    orders.status,
    orders.order_amount
