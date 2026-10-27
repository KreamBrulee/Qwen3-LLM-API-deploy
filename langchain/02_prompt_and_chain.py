"""
LESSON 2 — Prompt templates and chains (the `|` pipe).

GOAL: Stop hard-coding prompts. Build a reusable template with blanks,
      then connect template -> model -> text-extractor into a single
      "chain" you can call with just the blanks filled in.

RUN IT:
    .venv\\Scripts\\python langchain\\02_prompt_and_chain.py

--------------------------------------------------------------------------
TWO CONCEPTS:

1. PromptTemplate — a prompt with named blanks ({like_this}). You fill the
   blanks at call time. This is the clean version of f-string prompt-building
   you'd otherwise scatter around your code.

2. The PIPE OPERATOR `|` — LangChain lets you connect pieces with `|`, read
   left-to-right like a Unix pipe:

       prompt | model | parser

   means: take the input, format it into a prompt, feed that to the model,
   then parse the model's reply. The whole thing becomes ONE callable object
   (a "chain"). This is called LCEL — LangChain Expression Language.

   Each piece is a "Runnable": anything with an .invoke() method. Because
   they all share that interface, they snap together like Lego.
--------------------------------------------------------------------------
"""

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

model = ChatOpenAI(
    base_url="http://127.0.0.1:8080/v1",
    api_key="not-needed",
    model="qwen3-14b-q4_k_m",
    temperature=0.3,
)

# ── Piece 1: the prompt template ────────────────────────────────────────────
# {language} and {concept} are blanks we fill in later. Notice the template
# is reusable: same structure, different fill-ins every call.
prompt = ChatPromptTemplate.from_messages(
    [
        ("system", "You are a {language} tutor. Explain clearly for a beginner."),
        ("human", "Explain this concept with a tiny code example: {concept}"),
    ]
)

# ── Piece 3: the output parser ──────────────────────────────────────────────
# The model returns an AIMessage object. StrOutputParser just pulls the
# `.content` string out, so the chain's final output is plain text.
parser = StrOutputParser()

# ── Snap them together with | ───────────────────────────────────────────────
chain = prompt | model | parser

# ── Call the chain ──────────────────────────────────────────────────────────
# We only supply the blanks. The chain handles formatting, calling the model,
# and parsing. Compare this to the manual JSON-wrangling in your proxy.
result = chain.invoke({"language": "Python", "concept": "a list comprehension"})

print("=" * 60)
print(result)
print("=" * 60)

# TRY THIS: change the dict values and run again — same chain, new question:
#   chain.invoke({"language": "JavaScript", "concept": "async/await"})
