"""Read-only Delibocados conversation inbox from existing multi-tenant Supabase PostgreSQL.
Does not send WhatsApp messages or guess which external phone belongs to this business.
"""
import json
import re
import subprocess

DB = ["docker","exec","-i","supabase-db","psql","-X","-q","-A","-t",
      "-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1"]
COMPANY = "delibocados"

def query(sql):
    result=subprocess.run(DB,input=sql,text=True,capture_output=True,timeout=10)
    if result.returncode:
        raise RuntimeError("CONVERSATIONS_DATABASE_UNAVAILABLE")
    lines=[l.strip() for l in result.stdout.splitlines() if l.strip()]
    if len(lines)!=1:
        raise RuntimeError("CONVERSATIONS_QUERY_UNEXPECTED")
    try:
        data=json.loads(lines[0])
    except ValueError:
        raise RuntimeError("CONVERSATIONS_QUERY_INVALID")
    if not isinstance(data,list):
        raise RuntimeError("CONVERSATIONS_QUERY_INVALID")
    return data

def conversations():
    sql="""SELECT coalesce(json_agg(row_to_json(c)),'[]'::json)
FROM (
SELECT id, contact_phone, last_message, last_message_at, status, channel
FROM public.conversations
WHERE company_id='delibocados' AND channel='whatsapp'
ORDER BY last_message_at DESC NULLS LAST
LIMIT 100
) AS c;"""
    result=query(sql)
    return {"ok":True, "companyId":COMPANY, "conversations":result}

def messages(phone):
    if not isinstance(phone,str) or not re.fullmatch(r"\+?[0-9]{8,16}",phone):
        raise ValueError("INVALID_CONTACT_PHONE")
    phone_escaped=phone.replace("'","")
    sql=f"""SELECT coalesce(json_agg(row_to_json(m)),'[]'::json)
FROM (
SELECT id, contact_phone, direction, body, message_type,
       delivery_status, occurred_at, created_at
FROM public.messages
WHERE company_id='delibocados' AND channel='whatsapp'
 AND contact_phone='{phone_escaped}'
ORDER BY occurred_at DESC NULLS LAST LIMIT 200
) AS m;"""
    result=query(sql)
    result.reverse()
    return {"ok":True,"companyId":COMPANY,"contactPhone":phone,"messages":result}
