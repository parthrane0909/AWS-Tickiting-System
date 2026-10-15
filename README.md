# TickDesk — AWS Serverless Ticketing System POC

TickDesk is a Vue 3 ticketing proof of concept backed by AWS API Gateway, Lambda, DynamoDB, Cognito and a private S3 bucket. This repository also supports a separate local JSON/dev-auth mode for development.

## Assignment feature coverage

| Requirement | Implementation |
|---|---|
| Cognito Hosted UI sign-up/sign-in | OAuth authorization code + PKCE; Cognito user pool and Customer/Agent groups |
| Customer/Agent authorization | API Gateway JWT authorizer plus backend group and ticket-ownership checks |
| Ticket screens | Login, list/search/filter, create, ticket detail, activity, comments |
| Ticket workflow | Customer creates/edits own OPEN tickets; Agent changes status and assignee |
| DynamoDB | Separate tickets, comments and activity tables |
| Attachments | Private S3, presigned POST (120 s, 5 MiB maximum), verified ownership, signed GET (60 s) |
| API | `/api/tickets`, `/api/tickets/:id`, `/api/tickets/:id/comments`, `/api/tickets/:id/history`, `/api/attachments/presign` (and `/api/tickets/presigned-url` alias) |

The original brief's routes omit the `/api` prefix. The application uses `/api` consistently. Runtime Node.js **22** is used in place of the brief's Node.js 20.

## Install and run locally (no AWS)

Requires Node.js 22 (see `.nvmrc`), npm and two terminals.

```bash
npm run install:all
AUTH_MODE=dev PERSISTENCE_BACKEND=json npm run dev:backend
# In a second terminal:
npm run dev:frontend
```

Open http://localhost:5173. The local development sign-in uses `alice@example.com`, `bob@example.com` (Customer) and `eve@example.com` (Agent); the local-only development password is `local-dev-pass`. This mode is **not secure authentication**; do not expose it to the Internet.

## Connect the Vue frontend to the deployed AWS backend

Create `frontend/.env.local` (do not commit this file):

```dotenv
VITE_AUTH_MODE=cognito
VITE_API_BASE_URL=https://s4q5cb0tf7.execute-api.ap-south-1.amazonaws.com
VITE_COGNITO_CLIENT_ID=71g9osi7smmo11e03mdvnq9sln
VITE_COGNITO_ISSUER=https://cognito-idp.ap-south-1.amazonaws.com/ap-south-1_xONIeDCsK
VITE_COGNITO_DOMAIN=https://tickdesk-685394474319-ap-south-1.auth.ap-south-1.amazoncognito.com
```

```bash
npm run dev:frontend
```

Use the Cognito Hosted UI, not the local dev-login form. `http://localhost:5173/auth/callback` is registered in the Cognito app client. The Vue frontend is deployed publicly on AWS using a Lambda Function URL. Users can access TickDesk without running a local server. Local Vite remains available for development. Do not include real passwords, tokens, signed URLs, or AWS credentials in the repository or screenshots.

The deployed Cognito post-confirmation Lambda automatically assigns newly confirmed self-signups to the `Customer` group. This workflow has been verified on AWS. Existing users without a group require a one-time group assignment; Agent creation and assignment remain admin-controlled.

## AWS infrastructure currently used

- Region: `ap-south-1`; named CLI profile: `tickdesk-builder`.
- `tickdesk-poc-auth`: Cognito user pool, Hosted UI client, Customer/Agent groups.
- `tickdesk-poc-data`: DynamoDB ticket, comment and activity tables.
- `tickdesk-poc-api`: HTTP API with JWT authorization, Node.js 22 Lambda, scoped DynamoDB/S3 permissions and private S3 attachment bucket.
- API base: `https://s4q5cb0tf7.execute-api.ap-south-1.amazonaws.com`.
- S3 bucket: `tickdesk-poc-api-ticketingattachmentsbucket-c8v5bhh4xolm`. Public access blocked, SSE-S3 enabled; temporary `pending/` objects expire after 1 day. Ticket attachments live under `tickets/`.

Infrastructure templates: `infrastructure/template.yaml` (data), `infrastructure/cognito.yaml` (auth), `infrastructure/api.yaml` (API+S3).

## Key endpoints

All `/api/tickets*`, `/api/attachments*`, and `/api/agents` routes require authentication. In AWS mode, API Gateway validates the JWT and the Lambda service re-verifies Cognito access tokens and groups.

| Method | Path | Action |
|---|---|---|
| GET | `/api/me` | Current verified user |
| GET | `/api/tickets` | Scoped list with search/status/priority/category and pagination |
| POST | `/api/tickets` | Create ticket (Customer) |
| GET | `/api/tickets/:id` | Read ticket (owner or Agent) |
| PUT | `/api/tickets/:id` | Edit own OPEN ticket or Agent workflow |
| GET/POST | `/api/tickets/:id/comments` | Read/add comments |
| GET | `/api/tickets/:id/history` | Activity timeline |
| GET | `/api/agents` | Verified Agent directory |
| POST | `/api/attachments/presign` | S3 presigned POST (Customer only) |
| POST | `/api/tickets/presigned-url` | Compatibility alias for assignment's presigned URL route |
| GET | `/api/tickets/:id/attachment` | Local bytes or authorized temporary S3 URL |

Local mode additionally supports `POST /api/attachments` for base64-file upload and development-only login endpoints.

## Tests and final acceptance

```bash
bash scripts/final-check.sh
```

That runs the backend tests (including S3 validation), Cognito trigger unit checks and the frontend production build, and validates the SAM template if SAM is installed. Tests using S3 mocks are **not** a replacement for cloud deployment verification. The live AWS Customer workflow, Agent workflow and new Customer sign-up have been verified.

## Limitations / security notes

- The frontend is hosted through an AWS Lambda Function URL. CloudFront deployment was blocked by AWS account-verification restrictions.
- A Cognito group must be present in the access token; no-group and dual-group users are rejected. The post-confirmation trigger only handles *future* newly confirmed self-registrations after deployment.
- File uploads are limited to one per ticket, restricted to PNG/JPEG/PDF/TXT and 5 MiB. MIME type is checked, but file contents are not malware-scanned; S3 objects are private and signed links expire.
- Orphaned pending files are subject to a 1-day lifecycle rule; S3 cleanup is asynchronous. Rare database/S3 partial failures may need manual reconciliation.
- IAM for the `tickdesk-builder` development profile has broad administrative permissions; narrow these for a production rollout. The Cognito onboarding trigger IAM scope is restricted to user pools in the AWS account/region because a per-pool reference would produce a CloudFormation dependency cycle.
- The $5 AWS Budget is a **notification, not a hard spending cap**. Delete unneeded retained S3 objects and other test resources when finished.
- No SLA, HA, concurrency guarantee, malware scanning, large-file multipart support, or production-grade account recovery is claimed for this POC.

## Live AWS deployment

**Public website:**
https://zju6yyayrvc22msohephc6ljau0dthtm.lambda-url.ap-south-1.on.aws/

TickDesk is deployed using the following AWS services:

| Service | Purpose |
|---|---|
| AWS Lambda Function URL | Public HTTPS Vue frontend |
| Amazon Cognito | User signup, login and Customer/Agent roles |
| Amazon API Gateway | JWT-protected backend endpoints |
| AWS Lambda | Ticketing business logic |
| Amazon DynamoDB | Tickets, comments and activity |
| Amazon S3 | Private ticket attachments |

### CloudFormation stacks

- `tickdesk-poc-auth` — Cognito authentication
- `tickdesk-poc-data` — DynamoDB tables
- `tickdesk-poc-api` — Ticketing API and private S3 attachments
- `tickdesk-poc-frontend-web` — Public Vue frontend

### Frontend deployment

The frontend hosting implementation is located in:

- `frontend-hosting/handler.mjs`
- `infrastructure/frontend-lambda.yaml`

The built frontend files are generated rather than committed.

To rebuild and deploy the frontend:

1. Configure `frontend/.env.local` using the AWS values documented above.
2. Run `npm run build`.
3. Run `mkdir -p frontend-hosting/site`.
4. Run `cp -a frontend/dist/. frontend-hosting/site/`.
5. Deploy using AWS SAM with the following command:

`sam deploy --template-file infrastructure/frontend-lambda.yaml --stack-name tickdesk-poc-frontend-web --region ap-south-1 --profile tickdesk-builder --resolve-s3 --capabilities CAPABILITY_IAM`

### Verified functionality

- Public HTTPS frontend access
- Cognito Customer login and automatic Customer-group assignment
- Customer and Agent ticket workflows
- Ticket creation, editing, searching and filtering
- Comments and activity history
- Private S3 attachment upload and download
- Customer authorization restrictions

The public frontend was tested against the deployed AWS backend.

### CloudFront limitation

CloudFront was attempted, but AWS rejected distribution creation
because the account requires additional verification.

For this POC, the Vue frontend is successfully hosted through
an AWS Lambda Function URL instead.

### Costs

AWS resources may incur charges. AWS Budget alerts do not
automatically stop spending.
