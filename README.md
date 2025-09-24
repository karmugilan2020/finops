## 🧱 New/Updated Project Tree
```
finops-selfhosted/
├─ docker-compose.yml # UPDATED: adds worker
├─ .env # UPDATED: add AWS + CRON
├─ migrations/
│ └─ 001_init.sql # same as before
├─ policies/
│ └─ aws.yml # NEW: policy definitions
├─ api/
│ ├─ package.json # UPDATED deps
│ ├─ Dockerfile
│ ├─ server.js # UPDATED with trigger routes
│ ├─ db.js
│ └─ migrate.js
└─ worker/ # NEW
├─ package.json
├─ Dockerfile
└─ src/
├─ index.js # cron scheduler
├─ db.js # pg pool
├─ collectors/
│ ├─ awsInventory.js # EC2 + EBS
│ └─ awsCosts.js # Cost Explorer daily
└─ engine/
├─ runPolicies.js # policy evaluation
└─ utils.js # helpers
```


docker compose build
docker compose up -d

docker compose exec worker node -e "import('./src/collectors/awsInventory.js').then(m=>m.runAwsInventory())"
docker compose exec worker node -e "import('./src/collectors/awsCosts.js').then(m=>m.runAwsCosts())"
docker compose exec worker node -e "import('./src/engine/runPolicies.js').then(m=>m.runPolicies())"

#.env
DATABASE_URL=postgres://finops:finops@postgres:5432/finops
CORS_ORIGINS=http://localhost:5173
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=YOUR_KEY
AWS_SECRET_ACCESS_KEY=YOUR_SECRET
CRON_INVENTORY=*/15 * * * *
CRON_COSTS=0 2 * * *
POLICY_FILE=/app/policies/aws.yml


(Optional) trigger now:
docker compose exec worker node -e "import('./src/collectors/awsInventory.js').then(m=>m.runAwsInventory())"
docker compose exec worker node -e "import('./src/collectors/awsCosts.js').then(m=>m.runAwsCosts())"
docker compose exec worker node -e "import('./src/engine/runPolicies.js').then(m=>m.runPolicies())"

curl http://localhost:8080/health
curl http://localhost:8080/summary


# API should be healthy now
curl http://localhost:8080/health

# Kick collectors & policies immediately (so you don't wait for cron)
docker compose exec worker node -e "import('./src/collectors/awsInventory.js').then(m=>m.runAwsInventory())"
docker compose exec worker node -e "import('./src/collectors/awsCosts.js').then(m=>m.runAwsCosts())"
docker compose exec worker node -e "import('./src/engine/runPolicies.js').then(m=>m.runPolicies())"

# See data
curl http://localhost:8080/summary
curl "http://localhost:8080/recommendations?status=open"



{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "ec2:Describe*",
      "ce:GetCostAndUsage",
      "ce:GetCostAndUsageWithResources",
      "ce:GetDimensionValues",
      "ce:GetCostCategories"
    ],
    "Resource": "*"
  }]
}








