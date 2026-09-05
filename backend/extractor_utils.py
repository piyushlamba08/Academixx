import re
import random
from typing import List


def parse_raw_questions(raw_text: str) -> List[dict]:
    lines = [l.strip() for l in raw_text.split("\n") if l.strip()]
    
    parsed_questions = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        
        # Question stem — starts with number + dot
        q_match = re.match(r'^\d+[\.\)]\s+(.+)', line)
        if not q_match:
            i += 1
            continue
        
        question_stem = q_match.group(1).strip()
        i += 1
        
        # Collect options (a), (b), (c), (d)
        options = {}
        while i < len(lines):
            opt_match = re.match(r'^\(([abcdABCD])\)\s*(.+)', lines[i])
            if opt_match:
                key = opt_match.group(1).lower()
                val = opt_match.group(2).strip()
                options[key] = val
                i += 1
            else:
                break
        
        # Collect answer line
        correct_answer = ""
        if i < len(lines):
            ans_match = re.match(r'^[Aa]nswer[:\s]+(.+)', lines[i])
            if ans_match:
                correct_answer = ans_match.group(1).strip()
                i += 1
        
        if len(options) == 4:
            opts_list = [options.get('a',''), options.get('b',''), options.get('c',''), options.get('d','')]
            
            # correctAnswer ko options mein match karo
            matched_answer = ""
            for opt in opts_list:
                if opt.strip().lower() == correct_answer.strip().lower():
                    matched_answer = opt
                    break
            
            if not matched_answer:
                matched_answer = correct_answer
            
            parsed_questions.append({
                "question": question_stem,
                "options": opts_list,
                "correctAnswer": matched_answer,
                "inputMode": "mcq"
            })
        
    random.shuffle(parsed_questions)
    return parsed_questions
