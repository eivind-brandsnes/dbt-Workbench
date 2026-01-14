select
    customer_id,
    customer_name as name,
    customer_email as email
from {{ ref('raw_customers') }}
