import psycopg2
import sys

regions = [
    "aws-0-eu-central-1.pooler.supabase.com",
    "aws-0-eu-west-1.pooler.supabase.com",
    "aws-0-eu-west-2.pooler.supabase.com",
    "aws-0-eu-west-3.pooler.supabase.com",
    "aws-0-us-east-1.pooler.supabase.com",
    "aws-0-us-west-1.pooler.supabase.com",
    "aws-0-us-east-2.pooler.supabase.com",
    "aws-0-us-west-2.pooler.supabase.com",
    "aws-0-ap-southeast-1.pooler.supabase.com",
    "aws-0-ap-northeast-1.pooler.supabase.com",
    "aws-0-ap-northeast-2.pooler.supabase.com",
    "aws-0-ap-southeast-2.pooler.supabase.com",
    "aws-0-ap-south-1.pooler.supabase.com",
    "aws-0-sa-east-1.pooler.supabase.com",
    "aws-0-ca-central-1.pooler.supabase.com",
]

project_ref = "svwpmpkwhuufkuwycdwn"
password = "LqbrL9jnpZLguKEf"

for region in regions:
    print(f"Testing {region}...")
    try:
        conn = psycopg2.connect(
            host=region,
            port=6543,
            user=f"postgres.{project_ref}",
            password=password,
            dbname="postgres",
            connect_timeout=3
        )
        print(f"SUCCESS! The region is: {region}")
        conn.close()
        sys.exit(0)
    except Exception as e:
        pass

print("Could not find the region.")
