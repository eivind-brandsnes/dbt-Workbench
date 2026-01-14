{{ config(materialized='table') }}

select *
from (
    values
        (1, 'Alice Johnson', 'alice@example.com'),
        (2, 'Bob Smith', 'bob@example.com'),
        (3, 'Carol Diaz', 'carol@example.com')
) as raw_customers(customer_id, customer_name, customer_email)
