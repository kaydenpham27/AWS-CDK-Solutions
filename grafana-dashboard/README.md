# AWS Grafana Dashboard For CloudWatch Monitoring

## Scenario

Your workloads depend heavily on the Lambda Functions as computing resources and your architectures have now grown too big to be able to easily `alt + tab` to monitor different functions at the same time. Such a scenario is frustrating and indeed might reduce your attentions due to context switching

## Solutions

AWS Grafana is a great solution for this scenario. It's a fully managed service that allows you to build a centralised monitoring dashboard of your choice. The design depends on you, but I'll list some of the key metrics that one may include to achieve good insights from the data.

### Metrics

1. Reliability

- Success/Error Rates: Try maximise success rate.
- Error Types & Messages: Investigate potential error types.
- Timeouts Rates: Maybe its too slow?

2. Performance

- Invocation Duration: Try to make it faster?
- Cold Start Duration: How long does it take to warm up?
- Memory Utilisation: Actual vs allocated memory, should we allocate less?
- Concurrent Executions: Might be a problem if too many concurrent executions.
- Throttles: Scale your concurrent limit if needed.

3. Cost

- Duration x Memory: GB-seconds consumed
- Invocation Count
- Data Transfer: Network costs
- Cost per Functions

4. Operational Insights

- Which function was invoked the most?
- Which function was the most expensive?
- Which function was the slowest?
- When errors occured? Why? Investigate trend?
- Comparing to previous monitoring period to identify trend
