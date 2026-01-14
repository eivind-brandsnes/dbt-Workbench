select
    order_id,
    customer_id,
    order_date,
    status,
    order_amount
from {{ ref('raw_orders') }}
