# AWS S3 + IAM Setup Guide

## Region
`us-east-1`

---

## Step 1 — Create the S3 Bucket

### Via AWS Console
1. Open **S3 → Create bucket**
2. **Bucket name:** `innovapos-uploads-prod` (or `innovapos-uploads-dev` for dev)
3. **AWS Region:** `us-east-1`
4. **Block Public Access:** Leave ALL four checkboxes **checked** (bucket is private)
5. **Versioning:** Enable (required for receipt/BR documents)
6. **Tags:** `Project=innovapos`, `Env=prod`
7. Click **Create bucket**

### CORS Configuration
After creation, open the bucket → **Permissions → CORS** and paste:
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "POST", "GET", "DELETE"],
    "AllowedOrigins": [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
      "https://app.innovasolutions.com",
      "https://admin.innovasolutions.com",
      "https://www.innovasolutions.com"
    ],
    "ExposeHeaders": ["ETag"]
  }
]
```

---

## Step 2 — Create IAM Policy

1. Open **IAM → Policies → Create policy**
2. Switch to **JSON** and paste the contents of `iam-policy.json`
3. **Policy name:** `innovapos-upload-policy`
4. Click **Create policy**

---

## Step 3 — Attach Policy

### Option A: EC2 Instance Role (Production — Recommended)
No hardcoded credentials. The AWS SDK auto-fetches credentials from the EC2 metadata service.

1. Open **IAM → Roles → Create role**
2. **Trusted entity:** AWS service → EC2
3. **Attach policy:** `innovapos-upload-policy`
4. **Role name:** `innovapos-ec2-role`
5. Go to your EC2 instance → **Actions → Security → Modify IAM role**
6. Select `innovapos-ec2-role`

The upload service will automatically use this role — no `AWS_ACCESS_KEY_ID` needed.

### Option B: IAM User (Development / Local)
1. Open **IAM → Users → Create user**
2. **User name:** `innovapos-upload-dev`
3. **Attach policy:** `innovapos-upload-policy`
4. Open the user → **Security credentials → Create access key**
5. Choose **Application running outside AWS**
6. Copy the Access Key ID and Secret

Then run:
```bash
aws configure --profile innovapos-dev
# Enter: Access Key ID, Secret, Region=us-east-1, output=json
```

Set in `services/upload-service/.env`:
```
AWS_PROFILE=innovapos-dev
```

---

## Step 4 — Environment Variables

### Production (.env on server)
```
AWS_REGION=us-east-1
AWS_S3_BUCKET=innovapos-uploads-prod
# No AWS_ACCESS_KEY_ID — uses EC2 instance role
```

### Development (.env local)
```
AWS_REGION=us-east-1
AWS_S3_BUCKET=innovapos-uploads-dev
AWS_PROFILE=innovapos-dev
```

---

## S3 Folder Structure

```
innovapos-uploads-prod/
└── tenants/
    └── {tenantId}/
        ├── menu/          ← Menu item images (.webp)
        ├── profiles/      ← User profile images (.webp)
        ├── logos/         ← Business logos (.webp)
        ├── receipts/      ← Payment receipts (.pdf, .webp)
        └── br-documents/  ← Business registration docs (.pdf)
```

---

## Accessing Files

Files are stored as **private** objects. The upload service returns:
- A **pre-signed URL** (1-hour expiry) for immediate display
- The **S3 key** for permanent storage in the database

Frontend should store the S3 key in the database, and call the upload service for a fresh pre-signed URL when displaying images.

For public assets (logos shown on the landing page), use a **public read bucket policy** on the `tenants/*/logos/` prefix only, or use CloudFront with signed URLs.
