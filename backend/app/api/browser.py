from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.core.deps import get_current_user
from app.services.browser_agent import browse_url, crawl_site, api_request, analyze_api

router = APIRouter(prefix="/api/browser", tags=["browser"])


class BrowseRequest(BaseModel):
    url: str
    extract_type: str = "text"


class CrawlRequest(BaseModel):
    url: str
    max_pages: int = 10


class ApiTestRequest(BaseModel):
    url: str
    method: str = "GET"
    headers: dict | None = None
    body: str | None = None
    auth_type: str | None = None
    auth_value: str | None = None


class ApiAnalyzeRequest(BaseModel):
    url: str
    model: str = "llama3"


@router.post("/browse")
async def run_browse(req: BrowseRequest, current_user: dict = Depends(get_current_user)):
    return await browse_url(req.url, req.extract_type)


@router.post("/crawl")
async def run_crawl(req: CrawlRequest, current_user: dict = Depends(get_current_user)):
    return await crawl_site(req.url, req.max_pages)


@router.post("/api-test")
async def run_api_test(req: ApiTestRequest, current_user: dict = Depends(get_current_user)):
    return await api_request(
        url=req.url, method=req.method, headers=req.headers,
        body=req.body, auth_type=req.auth_type, auth_value=req.auth_value,
    )


@router.post("/api-analyze")
async def run_api_analyze(req: ApiAnalyzeRequest, current_user: dict = Depends(get_current_user)):
    return await analyze_api(req.url, req.model)
