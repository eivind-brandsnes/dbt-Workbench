with customers as (
    select *
    from {{ ref('stg_customers') }}
),
orders as (
    select *
    from {{ ref('stg_orders') }}
),
payments as (
    select *
    from {{ ref('stg_payments') }}
)

select
    customers.customer_id,
    customers.name,
    customers.email,
    count(distinct orders.order_id) as total_orders,
    coalesce(sum(payments.amount), 0) as total_payments
from customers
left join orders
    on customers.customer_id = orders.customer_id
left join payments
    on orders.order_id = payments.order_id
group by
    customers.customer_id,
    customers.name,
    customers.email
