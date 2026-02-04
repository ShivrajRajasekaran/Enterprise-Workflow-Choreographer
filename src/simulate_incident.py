"""
Incident Simulation Script.

Use this to simulate various incident scenarios for demonstration purposes.
"""

import asyncio
import argparse
import httpx
from datetime import datetime
from typing import Dict, Any

# Predefined incident scenarios
SCENARIOS = {
    "database_outage": {
        "title": "Production Database Connection Failures",
        "message": "Critical: PostgreSQL primary database showing connection pool exhaustion. "
                   "Error rate at 45%. Multiple services reporting database timeouts.",
        "severity": "critical",
        "tags": ["database", "postgresql", "connection-pool", "production"],
        "metadata": {
            "error_count": 1547,
            "affected_endpoints": ["/api/users", "/api/orders", "/api/payments"],
            "last_successful_query": "2024-01-15T10:23:45Z"
        }
    },
    "api_latency": {
        "title": "Payment API High Latency Detected",
        "message": "Warning: Payment service response time increased to 5.2s (normal: 200ms). "
                   "Downstream timeout errors observed.",
        "severity": "high",
        "tags": ["api", "payment", "latency", "performance"],
        "metadata": {
            "p95_latency_ms": 5200,
            "p50_latency_ms": 3100,
            "baseline_latency_ms": 200,
            "affected_region": "us-east-1"
        }
    },
    "memory_leak": {
        "title": "Order Service Memory Leak",
        "message": "Memory usage of order-service pods increasing steadily. "
                   "Current usage at 89% of limit. OOM kill imminent.",
        "severity": "high",
        "tags": ["kubernetes", "memory", "order-service", "oom"],
        "metadata": {
            "pod_name": "order-service-7d8f9b6c5-xk2lm",
            "memory_usage_percent": 89,
            "memory_limit": "2Gi",
            "uptime_hours": 72
        }
    },
    "security_alert": {
        "title": "Unusual Login Pattern Detected",
        "message": "Security: Multiple failed login attempts from unusual IP ranges. "
                   "Possible brute force attack on admin endpoints.",
        "severity": "critical",
        "tags": ["security", "authentication", "brute-force"],
        "metadata": {
            "failed_attempts": 2341,
            "unique_ips": 47,
            "target_endpoint": "/admin/login",
            "geo_locations": ["unknown", "russia", "china"]
        }
    },
    "deployment_failure": {
        "title": "Production Deployment Failed - Rollback Required",
        "message": "Deployment of v2.4.0 to production failed. Health checks failing on 3/5 pods. "
                   "Service degradation detected.",
        "severity": "high",
        "tags": ["deployment", "rollback", "health-check", "production"],
        "metadata": {
            "deployment_version": "v2.4.0",
            "previous_version": "v2.3.9",
            "healthy_pods": 2,
            "unhealthy_pods": 3,
            "deployment_id": "deploy-20240115-143022"
        }
    },
    "network_issue": {
        "title": "Inter-Service Communication Failures",
        "message": "Network: High packet loss detected between services in kubernetes cluster. "
                   "Service mesh reporting connection resets.",
        "severity": "medium",
        "tags": ["network", "kubernetes", "service-mesh", "packet-loss"],
        "metadata": {
            "packet_loss_percent": 12,
            "affected_services": ["user-service", "inventory-service"],
            "cluster": "prod-us-east"
        }
    }
}


async def send_alert(
    base_url: str,
    scenario_name: str,
    source: str = "simulation"
) -> Dict[str, Any]:
    """Send a simulated alert to the orchestrator."""
    
    if scenario_name not in SCENARIOS:
        available = ", ".join(SCENARIOS.keys())
        raise ValueError(f"Unknown scenario: {scenario_name}. Available: {available}")
    
    scenario = SCENARIOS[scenario_name]
    
    payload = {
        "source": source,
        "alert_id": f"sim-{scenario_name}-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "title": scenario["title"],
        "message": scenario["message"],
        "severity": scenario["severity"],
        "tags": scenario["tags"],
        "metadata": scenario["metadata"]
    }
    
    print(f"\n{'='*60}")
    print(f"🚨 Simulating Incident: {scenario_name}")
    print(f"{'='*60}")
    print(f"Title: {scenario['title']}")
    print(f"Severity: {scenario['severity'].upper()}")
    print(f"Tags: {', '.join(scenario['tags'])}")
    print(f"\nSending to: {base_url}/api/webhook/alert")
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{base_url}/api/webhook/alert",
                json=payload,
                timeout=30.0
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"\n✅ Incident Created Successfully!")
                print(f"   Incident ID: {result.get('id')}")
                print(f"   Severity: {result.get('severity')}")
                print(f"   Category: {result.get('category')}")
                print(f"\n🔄 Workflow triggered in background...")
                return result
            else:
                print(f"\n❌ Failed to create incident")
                print(f"   Status: {response.status_code}")
                print(f"   Response: {response.text}")
                return {"error": response.text}
                
        except httpx.ConnectError:
            print(f"\n❌ Connection failed!")
            print(f"   Make sure the orchestrator is running at {base_url}")
            return {"error": "Connection failed"}


async def run_demo_sequence(base_url: str):
    """Run a demo sequence of incidents."""
    print("\n" + "="*60)
    print("🎬 ENTERPRISE WORKFLOW CHOREOGRAPHER DEMO")
    print("="*60)
    print("\nThis demo will simulate a sequence of incidents to showcase")
    print("the autonomous workflow orchestration capabilities.\n")
    
    scenarios_to_run = ["database_outage", "api_latency", "security_alert"]
    
    for i, scenario in enumerate(scenarios_to_run, 1):
        print(f"\n[{i}/{len(scenarios_to_run)}] Running scenario: {scenario}")
        await send_alert(base_url, scenario)
        
        if i < len(scenarios_to_run):
            print("\nWaiting 10 seconds before next scenario...")
            await asyncio.sleep(10)
    
    print("\n" + "="*60)
    print("✅ Demo sequence completed!")
    print("="*60)
    print("\nCheck the following:")
    print("  - ServiceNow: New incident tickets created")
    print("  - Slack: Incident channels created with teams assembled")
    print("  - Confluence: Post-mortem templates generated")
    print("  - GitHub: Issues created and commits analyzed")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Simulate incidents for the Enterprise Workflow Choreographer"
    )
    parser.add_argument(
        "--url",
        default="http://localhost:8000",
        help="Base URL of the orchestrator (default: http://localhost:8000)"
    )
    parser.add_argument(
        "--scenario",
        choices=list(SCENARIOS.keys()),
        help="Specific scenario to run"
    )
    parser.add_argument(
        "--demo",
        action="store_true",
        help="Run full demo sequence"
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List available scenarios"
    )
    
    args = parser.parse_args()
    
    if args.list:
        print("\n📋 Available Incident Scenarios:")
        print("-" * 40)
        for name, scenario in SCENARIOS.items():
            print(f"\n  {name}:")
            print(f"    Title: {scenario['title']}")
            print(f"    Severity: {scenario['severity']}")
        return
    
    if args.demo:
        asyncio.run(run_demo_sequence(args.url))
    elif args.scenario:
        asyncio.run(send_alert(args.url, args.scenario))
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
