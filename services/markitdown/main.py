"""
MarkItDown HTTP 服务
将任意格式文件（PDF / DOCX / XLSX / PPTX / HTML / TXT 等）转换为 Markdown。
供 Nexus 后端调用，端口 3004。
"""

import os
import tempfile
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from markitdown import MarkItDown

app = FastAPI(title="MarkItDown Service", version="1.0.0")
md = MarkItDown()


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/convert")
async def convert(file: UploadFile = File(...)):
    """
    接收任意格式文件，返回转换后的 Markdown 文本。
    file.filename 中的扩展名用于 MarkItDown 判断文件类型。
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="文件名不能为空")

    suffix = os.path.splitext(file.filename)[1].lower()
    if not suffix:
        suffix = ".bin"

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="文件内容为空")

    # 写入临时文件（MarkItDown 需要读取文件路径，不支持直接传 bytes）
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        result = md.convert(tmp_path)
        markdown_text = result.text_content or ""
        return JSONResponse({
            "markdown": markdown_text,
            "title": result.title or file.filename,
            "length": len(markdown_text)
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"转换失败：{str(e)}")
    finally:
        os.unlink(tmp_path)
