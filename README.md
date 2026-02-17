# Bedrock RAG Agent

A simple hello world Strands agent that integrates with AWS Bedrock for EUNA Solutions.

## Setup

### Prerequisites
- Python 3.8 or higher
- pip (Python package installer)

**Note**: If Python is not installed, please install it from https://python.org or through your system's package manager.

### Installation

1. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
   
   Or using setup.py:
   ```bash
   pip install -e .
   ```

2. Set up AWS credentials (required for Bedrock access):
   ```bash
   export AWS_BEDROCK_API_KEY=your_api_key_here
   ```

## Usage

Run the agent:
```bash
python agent.py
```

## Project Structure

- `agent.py` - Main agent implementation
- `requirements.txt` - Python dependencies
- `setup.py` - Package setup configuration
- `README.md` - This file

## Development

This is a hello world implementation focusing on basic Strands agent functionality with AWS Bedrock integration.