select
    payment_id,
    order_id,
    payment_date,
    payment_method,
    amount
from {{ ref('raw_payments') }}
