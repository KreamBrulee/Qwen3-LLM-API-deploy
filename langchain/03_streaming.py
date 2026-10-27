"""
LESSON 3 — Streaming tokens as they arrive.

GOAL: Print the model's reply word-by-word as it generates, instead of
      waiting for the whole thing. This is what your proxy's streamer()
      generator does by hand (main.py), token-accumulation and all.

RUN IT:
    .venv\\Scripts\\python langchain\\03_streaming.py

--------------------------------------------------------------------------
ONE CONCEPT: .stream() instead of .invoke()

Every Runnable (model, chain, template) supports BOTH:
    .invoke(x)  -> run fully, return the final result
    .stream(x)  -> return a generator that yields pieces as they're produced

In your proxy you manually:
    - open an httpx streaming connection
    - split raw bytes on "\\n"
    - strip "data: " prefixes
    - json.loads each chunk
    - dig out choices[0].delta.content
LangChain does all of that parsing internally. You just loop over chunks.
--------------------------------------------------------------------------
"""

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

model = ChatOpenAI(
    base_url="http://127.0.0.1:8080/v1",
    api_key="not-needed",
    model="qwen3-14b-q4_k_m",
    temperature=0.7,
)

prompt = ChatPromptTemplate.from_messages(
    [("human", "Write a short haiku about {topic}.")]
)

chain = prompt | model | StrOutputParser()

print("=" * 60)
print("Streaming reply:\n")

# Each `chunk` here is already the plain-text delta (because StrOutputParser
# is last in the chain). end="" + flush=True makes it appear live in the
# terminal instead of buffering.
for chunk in chain.stream({"topic": "a compiler finally passing all tests"}):
    print(chunk, end="", flush=True)

print("\n" + "=" * 60)

# WHERE THIS CONNECTS TO YOUR PROXY:
# Your streamer() also *accumulates* tokens into a list so it can save the
# full reply to SQLite afterward. The LangChain equivalent: collect chunks
# into a list while you stream, then join them:
#
#     collected = []
#     for chunk in chain.stream({"topic": "..."}):
#         print(chunk, end="", flush=True)
#         collected.append(chunk)
#     full_reply = "".join(collected)   # <- what you'd save to the DB
