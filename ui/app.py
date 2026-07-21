import streamlit as st
import requests

API_URL = "http://api:8000"

st.set_page_config(page_title="Multimodal RAG Engine", page_icon="🤖")
st.title("Multimodal RAG Engine")

# Initialize chat history
if "messages" not in st.session_state:
    st.session_state.messages = []

# Sidebar for file upload
with st.sidebar:
    st.header("Document Upload")
    uploaded_file = st.file_uploader("Upload a PDF or TXT file", type=["pdf", "txt"])
    
    if uploaded_file is not None:
        if st.button("Upload"):
            with st.spinner("Uploading..."):
                files = {"file": (uploaded_file.name, uploaded_file.getvalue(), uploaded_file.type)}
                try:
                    response = requests.post(f"{API_URL}/upload", files=files)
                    response.raise_for_status()
                    result = response.json()
                    st.success(f"Upload successful! Task ID: {result.get('task_id', 'N/A')}")
                except requests.exceptions.RequestException as e:
                    st.error(f"Error uploading file: {e}")

# Display chat messages from history on app rerun
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

# React to user input
if prompt := st.chat_input("What would you like to know?"):
    # Display user message in chat message container
    st.chat_message("user").markdown(prompt)
    # Add user message to chat history
    st.session_state.messages.append({"role": "user", "content": prompt})

    # Display assistant response in chat message container
    with st.chat_message("assistant"):
        try:
            # Send query to API and handle streaming response
            response = requests.post(
                f"{API_URL}/chat", 
                json={"query": prompt},
                stream=True
            )
            response.raise_for_status()
            
            # Generator for streaming the response chunks
            def generate_response():
                for chunk in response.iter_content(chunk_size=1024):
                    if chunk:
                        yield chunk.decode("utf-8")
                        
            # Write stream to the UI
            full_response = st.write_stream(generate_response())
            
        except requests.exceptions.RequestException as e:
            full_response = f"Error communicating with API: {e}"
            st.error(full_response)
        
    # Add assistant response to chat history
    st.session_state.messages.append({"role": "assistant", "content": full_response})
