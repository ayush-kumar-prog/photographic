# Step 5 Verification Guide

> How to verify that the Search API Service is working correctly

## 🚀 Quick Verification

### 1. Automated Verification Script
```bash
# Run comprehensive verification
./scripts/verify-step5.sh

# This tests:
# - Service health checks
# - API endpoint functionality  
# - Query understanding
# - Performance metrics
# - Error handling
# - Component tests
# - Demo queries
```

### 2. Manual Service Checks

**Check all services are running:**
```bash
# Screenpipe (data capture)
curl -s http://localhost:3030/health | jq '.'

# Ingest Bridge (data processing)  
curl -s http://localhost:3031/health | jq '.'

# Search API (search engine)
curl -s http://localhost:3032/health | jq '.'
```

**Expected responses:**
- Screenpipe: `{"status": "degraded", "frame_status": "ok"}`
- Ingest Bridge: `{"status": "healthy", "uptime": ...}`
- Search API: `{"status": "healthy", "services": {"search": {"status": "up"}}}`

## 🔍 Core Functionality Tests

### 1. Basic Search
```bash
# Simple search
curl -s "http://localhost:3032/search?q=test" | jq '.'

# Should return:
# {
#   "mode": "exact|jog",
#   "confidence": 0.xx,
#   "cards": [...],
#   "query_parsed": {...}
# }
```

### 2. Query Understanding
```bash
# Time parsing
curl -s "http://localhost:3032/search?q=yesterday" | jq '.query_parsed.time_window'

# App detection  
curl -s "http://localhost:3032/search?q=Safari%20browser" | jq '.query_parsed.app_hints'

# Intent recognition
curl -s "http://localhost:3032/search?q=price%20of%20product" | jq '.query_parsed.answer_field'
```

### 3. Performance Testing
```bash
# Response time test
time curl -s "http://localhost:3032/search?q=performance%20test" > /dev/null

# Should complete in < 1 second
```

### 4. Data Quality
```bash
# Check database has data
curl -s "http://localhost:3032/stats" | jq '.total_memories'

# Get recent memories
curl -s "http://localhost:3032/recent?limit=5" | jq '.memories | length'

# Verify search returns results (if data exists)
curl -s "http://localhost:3032/search?q=terminal" | jq '.cards | length'
```

## 🧪 Component Testing

### 1. Nugget Extractors
```bash
cd services/search-api
pnpm test:nugget-extractors

# Expected output:
# ✅ YouTube title extraction: 100% success
# ✅ Amazon price extraction: 100% success  
# ✅ Overall success: 77.8% (target: 75%)
```

### 2. Search Performance
```bash
cd services/search-api
pnpm test:search-performance

# Note: Requires data in database to run properly
```

## 📊 What to Look For

### ✅ Success Indicators

1. **Service Health**: All health endpoints return "healthy" or "ok"
2. **API Responses**: All endpoints return valid JSON with expected structure
3. **Query Parsing**: Time, app, and intent detection working
4. **Performance**: Search responses < 1 second
5. **Data Access**: Can retrieve stats and recent memories
6. **Error Handling**: Invalid requests return proper error messages
7. **Component Tests**: Nugget extractors pass with >75% success rate

### ⚠️ Warning Signs

1. **Service Down**: Health checks fail or return errors
2. **Slow Responses**: Search takes > 2 seconds consistently  
3. **Empty Results**: No data returned even with populated database
4. **Parse Failures**: Query understanding not working (no time_window, app_hints)
5. **Component Failures**: Nugget extractor tests fail completely

### ❌ Critical Issues

1. **Service Won't Start**: Port conflicts, missing dependencies
2. **Database Errors**: SQLite or ChromaDB connection failures
3. **OpenAI Errors**: API key issues, rate limiting
4. **Crash on Query**: Service crashes when searching

## 🔧 Troubleshooting

### Common Issues & Solutions

**1. Service Won't Start**
```bash
# Check ports are available
lsof -i :3032

# Check dependencies
cd services/search-api
pnpm install
pnpm build
```

**2. No Search Results**
```bash
# Check if database has data
curl -s http://localhost:3032/stats | jq '.total_memories'

# If 0, start ingest bridge and wait 10-15 minutes
cd services/ingest-bridge  
pnpm start
```

**3. ChromaDB Connection Issues**
```bash
# Check if ChromaDB is running
curl -s http://localhost:8000/api/v1/heartbeat

# Start ChromaDB if needed (see ingest-bridge docs)
```

**4. OpenAI API Issues**
```bash
# Check API key is set
echo $OPENAI_API_KEY

# Test API key works
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
     https://api.openai.com/v1/models | jq '.data[0].id'
```

**5. Performance Issues**
```bash
# Check service logs
tail -f services/search-api/logs/combined.log

# Monitor resource usage
top -pid $(pgrep -f "search-api")
```

## 📈 Performance Benchmarks

### Target Metrics
- **P95 Latency**: <700ms
- **Cache Hit Rate**: >50% for repeated queries
- **Memory Usage**: <200MB steady state
- **Nugget Extraction**: >75% success rate
- **Uptime**: 99%+ (no crashes during normal operation)

### Measurement Commands
```bash
# Latency test
for i in {1..10}; do
  time curl -s "http://localhost:3032/search?q=test$i" > /dev/null
done

# Cache test  
time curl -s "http://localhost:3032/search?q=cache_test" > /dev/null
time curl -s "http://localhost:3032/search?q=cache_test" > /dev/null

# Memory usage
ps aux | grep search-api | grep -v grep
```

## 🎯 Demo Scenarios

### Test These Specific Queries
```bash
# Time-based queries
curl -s "http://localhost:3032/search?q=yesterday%20terminal" | jq '.query_parsed.time_window'
curl -s "http://localhost:3032/search?q=2%20weeks%20ago%20Amazon" | jq '.query_parsed'

# App-specific queries  
curl -s "http://localhost:3032/search?q=Safari%20error%20dialog" | jq '.query_parsed.app_hints'
curl -s "http://localhost:3032/search?q=YouTube%20video%20title" | jq '.query_parsed'

# Intent-based queries
curl -s "http://localhost:3032/search?q=price%20of%20watch" | jq '.query_parsed.answer_field'
curl -s "http://localhost:3032/search?q=Apex%20score%20kills" | jq '.query_parsed.answer_field'
```

## ✅ Verification Checklist

- [ ] All services (Screenpipe, Ingest Bridge, Search API) are healthy
- [ ] Search API responds to basic queries with valid JSON
- [ ] Query parsing extracts time windows, app hints, and intent
- [ ] Search returns results (if database has data)
- [ ] Performance is acceptable (<1s for simple queries)
- [ ] Error handling works (invalid queries return proper errors)
- [ ] Nugget extractors pass component tests
- [ ] Cache improves performance on repeated queries
- [ ] Statistics endpoint shows database metrics
- [ ] Recent memories endpoint works

## 🔜 Ready for Next Step

Once verification passes, you're ready for **Step 7: SwiftUI Overlay**!

The search API provides all the endpoints and functionality needed for the macOS overlay application.
