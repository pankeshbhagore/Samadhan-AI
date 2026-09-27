class CircuitBreakerTripError extends Error {
  constructor(tripRecord) {
    super(`Circuit Breaker Tripped: ${tripRecord.reason}`);
    this.name = 'CircuitBreakerTripError';
    this.tripRecord = tripRecord;
  }
}

class CircuitBreaker {
  constructor({ maxConsecutiveFailures = 4, maxTokens = 10000, maxIterations = 20 } = {}) {
    this.maxConsecutiveFailures = maxConsecutiveFailures;
    this.maxTokens = maxTokens;
    this.maxIterations = maxIterations;
    
    this.state = {
      consecutiveFailures: 0,
      totalTokensConsumed: 0,
      iterations: 0
    };
  }

  /**
   * Tracks token usage from an LLM call.
   */
  recordLLMCall(tokens) {
    this.state.totalTokensConsumed += tokens;
    this._checkThresholds('LLM_CALL', null);
  }

  /**
   * Tracks success/failure of a tool execution.
   */
  recordToolCall(success, triggerNode, spanContext) {
    this.state.iterations++;

    if (success) {
      this.state.consecutiveFailures = 0;
    } else {
      this.state.consecutiveFailures++;
    }

    this._checkThresholds(triggerNode, spanContext);
  }

  /**
   * Evaluates thresholds and raises an error if breached.
   */
  _checkThresholds(triggerNode, spanContext) {
    let reason = null;

    if (this.state.consecutiveFailures >= this.maxConsecutiveFailures) {
      reason = `Exceeded max consecutive failures (${this.maxConsecutiveFailures})`;
    } else if (this.state.totalTokensConsumed > this.maxTokens) {
      reason = `Token budget exhausted (${this.state.totalTokensConsumed}/${this.maxTokens})`;
    } else if (this.state.iterations > this.maxIterations) {
      reason = `Iteration ceiling reached (${this.maxIterations})`;
    }

    if (reason) {
      const tripRecord = {
        triggerNode,
        reason,
        iterationCount: this.state.iterations,
        failureCount: this.state.consecutiveFailures,
        tokensConsumed: this.state.totalTokensConsumed,
        traceId: spanContext?.traceId || null,
        spanId: spanContext?.spanId || null,
      };
      
      throw new CircuitBreakerTripError(tripRecord);
    }
  }
}

module.exports = {
  CircuitBreakerTripError,
  CircuitBreaker
};
