<h1>Duck <a href="#Favicon"><img src="https://github.com/user-attachments/assets/b11de9df-f6b1-47a8-973f-cf66375748b9" width="33px"></a> GPT</h1>
<p>Unlimited ChatGPT using cloudflare workers and <b>workers AI</b>.</p>

<br>

## 🗜 Features
- **Clear Chat**: Start a new conversation at any time.
- **Settings**: Toggle particle effects and theme settings (light/dark).
- **Open Source Contributions**: Open to community contributions for further improvements.

<br>

## 📂 Models
| Models | Use Case |
| :--- | :--- |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | Best overall for complex reasoning, instruction following, and logic. |
| `@cf/meta/llama-3.1-8b-instruct-fp8-fast` | Recommended for general tasks and excellent efficiency. |
| `@cf/meta/llama-3.2-3b-instruct` | Ultra-lightweight and optimized for maximum speed/latency. |
| `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b` | Advanced reasoning and logic model distilled from DeepSeek R1. |
| `@cf/qwen/qwen2.5-coder-32b-instruct` | Top-tier performance for coding, development, and chat scenarios. |
| `@cf/qwen/qwq-32b` | Medium-sized reasoning model highly competitive for complex tasks. |
| `@cf/mistralai/mistral-small-3.1-24b-instruct` | Solid alternative featuring enhanced understanding and 128K context. |
| `@cf/google/gemma-3-12b-it` | Latest Google instruction-tuned model with strong multilingual support. |
| `@cf/openai/gpt-oss-120b` | General purpose, high-reasoning model (via SSO/compat). |

> [!WARNING]
> Check out [Cloudflare Limits](#-cloudflare-limits-free-plan) and choose a model based on your usage.

<br>

## ⚙️ Deploy
- Create a [Cloudflare](https://www.cloudflare.com/) **account**.
- Navigate to `Workers & Pages > Create > Create Worker`.
- Deploy the worker by clicking **Deploy**.
- Add AI binding in **Settings** name it `AI`.
- Edit the code by clicking **Edit Code**.
- Upload [worker.js](worker/worker.js) into **Cloudflare**.
- Finally, **Deploy**.

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/vauth/duckgpt)

<br>

## 📊 Cloudflare Limits (Free Plan)
- **Workers:**
    - **Request Limit:** 100,000 per day.
    - **CPU Time:** 10 ms per request.
- **Workers AI:**
    - **Daily Neurons:** 10,000 per day.
    - **Text Generation:** 300 requests per min.

### Neurons Costs:
| Model Type | Neurons per 1k Tokens (Input / Output) | Est. Daily Requests (~500 tokens) |
| :--- | :--- | :--- |
| **Micro LLMs** (e.g., Llama 3.2 1B/3B) | ~2.5 - 4.6 / ~18 - 30 | ~5,000+ |
| **Small LLMs** (e.g., Llama 3.1 8B, Gemma 3) | ~4 / ~35 | ~3,000+ |
| **Medium LLMs** (e.g., Qwen 2.5 32B, DeepSeek R1) | ~25 - 60 / ~75 - 90 | ~1,000 - 1,500 |
| **Large LLMs** (e.g., Llama 3.3 70B, GPT-OSS) | ~26 / ~204 | ~500 - 800 |

> [!NOTE]
> If you exceed these limits, Cloudflare will return a **429 (Too Many Requests)** error. On the Paid plan, you will only be billed at $0.011 / 1,000 Neurons for any usage beyond the initial 10,000 daily free allowance.

<br>

## 📡 Live Demo
Check out the live demo [here](https://duck.gpt-api.workers.dev). ([API Endpoint](https://duck.gpt-api.workers.dev/chat/?prompt=hi))

<br>

## 📷 Screenshot
<a href="#Screenshot"><img src="https://github.com/user-attachments/assets/38f60b5a-6a31-42ed-9446-0ce44a06f20f" width="1612px"></a>

<br>

## 📦 Python Usage ([main.py](main.py)) [DEAD]
```python
if __name__ == "__main__":
    Client = DuckGPT(model="gpt-4o-mini")
    histories = [{
        "role": "user",
        "content": "you are an expert python geek"
    }]
    question = "How to decode base64 using python"
    print(Client.Chat(question, histories))
```

<br>

## 🛠 Credits
- **Front-End Developer**: [Zarox](https://github.com/Zar0x) ([duck-gui](https://github.com/Zar0x/duck-gui))
- **Back-End Developer & GPT API**: [Vauth](https://github.com/Vauth)

<br>

## 🔗 Contributing
Contributions are welcome! Feel free to submit a pull request or report an issue.

<br>

## 🔎 License
```
MIT License

Copyright (c) 2026 Vauth

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
