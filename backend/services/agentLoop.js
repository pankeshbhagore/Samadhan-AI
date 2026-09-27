const { tracer } = require('../utils/telemetry');
const { CircuitBreaker, CircuitBreakerTripError } = require('../utils/circuitBreaker');
const { SpanStatusCode } = require('@opentelemetry/api');

class AgentLoop {
  constructor(flakyTool) {
    this.flakyTool = flakyTool;
  }

  async run(planPrompt) {
    // Thresholds configured specifically to match the challenge
    const breaker = new CircuitBreaker({ 
      maxConsecutiveFailures: 4, 
      maxTokens: 500, 
      maxIterations: 10 
    });
    
    let isResolved = false;

    return await tracer.startActiveSpan('agent.run', async (runSpan) => {
      runSpan.setAttribute('agent.plan_prompt', planPrompt);

      try {
        while (!isResolved) {
          await tracer.startActiveSpan('agent.loop_iteration', async (iterSpan) => {
            const currentIter = breaker.state.iterations;
            iterSpan.setAttribute('iteration.count', currentIter);

            // 1. LLM Call
            await tracer.startActiveSpan('llm.plan', async (llmSpan) => {
              const tokensConsumed = 50; // Mock token usage
              breaker.recordLLMCall(tokensConsumed);
              llmSpan.setAttribute('llm.tokens', tokensConsumed);
              llmSpan.end();
            });

            // 2. Tool Call
            let toolSuccess = false;
            await tracer.startActiveSpan('tool.execute', async (toolSpan) => {
              try {
                const result = await this.flakyTool();
                toolSuccess = true;
                toolSpan.setAttribute('tool.result', result);
                if (result === 'resolved') isResolved = true;
              } catch (err) {
                toolSuccess = false;
                toolSpan.recordException(err);
                toolSpan.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
              } finally {
                // The breaker checks thresholds immediately after the tool call is recorded
                breaker.recordToolCall(toolSuccess, 'TOOL_CALL', toolSpan.spanContext());
                toolSpan.end();
              }
            });

            iterSpan.end();
          });
        }
        
        runSpan.setStatus({ code: SpanStatusCode.OK });
        return { success: true, result: 'resolved', breakerState: breaker.state };

      } catch (err) {
        // If it's our structured circuit breaker error, we handle it gracefully!
        if (err instanceof CircuitBreakerTripError) {
          runSpan.addEvent('circuit_breaker.tripped', err.tripRecord);
          runSpan.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
          
          // Degrade gracefully without crashing the host process
          return { success: false, error: err.message, trace: err.tripRecord };
        }
        
        // Unexpected error (actual code crash)
        runSpan.recordException(err);
        runSpan.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
        throw err;
      } finally {
        runSpan.end();
      }
    });
  }
}

module.exports = { AgentLoop };
