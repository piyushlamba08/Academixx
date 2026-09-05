"""
Server-side math question generators — mirrors the client-side logic that
used to live entirely in frontend/random-math.js. Same behavior, same
question formats, now available as real backend endpoints.
"""
import random
import math


def format_num(n):
    """Render 12.0 as '12' but keep 12.5 as '12.5' — matches JS's number.toString()."""
    if isinstance(n, float) and n.is_integer():
        return str(int(n))
    return str(n)


def get_random_number(digits: int, allow_decimals: bool):
    lo = 10 ** (digits - 1)
    hi = 10 ** digits - 1
    num = random.randint(lo, hi)
    if allow_decimals and random.random() > 0.5:
        num = round(num + random.random(), 2)
    return num


def generate_options(correct_answer):
    """Builds 4 unique MCQ options: the correct answer + 3 plausible nearby wrong ones."""
    is_int = float(correct_answer).is_integer()
    options = {format_num(correct_answer)}
    attempts = 0
    while len(options) < 4 and attempts < 100:
        attempts += 1
        offset = random.random() * 20 - 10
        wrong = correct_answer + offset
        wrong = math.floor(wrong) if is_int else round(wrong, 2)
        if wrong != correct_answer and wrong > 0:
            options.add(format_num(wrong))

    fallback = 1
    while len(options) < 4:
        alt = correct_answer + fallback
        if alt > 0:
            options.add(format_num(alt))
        fallback += 1

    options_list = list(options)
    random.shuffle(options_list)
    return options_list


def generate_addition(digits, terms, allow_decimals):
    nums = [get_random_number(digits, allow_decimals) for _ in range(terms)]
    total = sum(nums)
    if allow_decimals:
        total = round(total, 2)
    return {"question": " + ".join(format_num(n) for n in nums) + " = ?", "correctAnswer": format_num(total)}


def generate_subtraction(digits, terms, allow_decimals):
    nums = [get_random_number(digits, allow_decimals) for _ in range(terms - 1)]
    final_ans = get_random_number(digits, allow_decimals)
    start_num = final_ans + sum(nums)
    if allow_decimals:
        start_num = round(start_num, 2)
    parts = [start_num] + nums
    return {"question": " - ".join(format_num(n) for n in parts) + " = ?", "correctAnswer": format_num(final_ans)}


def generate_multiplication(digits, terms, allow_decimals):
    nums = [get_random_number(digits, allow_decimals) for _ in range(terms)]
    prod = 1
    for n in nums:
        prod *= n
    if allow_decimals:
        prod = round(prod, 2)
    return {"question": " × ".join(format_num(n) for n in nums) + " = ?", "correctAnswer": format_num(prod)}


def generate_division(digits, allow_decimals):
    if not allow_decimals:
        ans = get_random_number(digits, False)
        denom = get_random_number(digits, False)
        num = ans * denom
        return {"question": f"{format_num(num)} ÷ {format_num(denom)} = ?", "correctAnswer": format_num(ans)}
    else:
        num = get_random_number(digits, True)
        denom = get_random_number(digits, False)
        ans = round(num / denom, 2)
        return {"question": f"{format_num(num)} ÷ {format_num(denom)} = ?", "correctAnswer": format_num(ans)}


def generate_square():
    num = random.randint(1, 50)
    return {"question": f"{num}² = ?", "correctAnswer": str(num * num)}


def generate_cube():
    num = random.randint(1, 20)
    return {"question": f"{num}³ = ?", "correctAnswer": str(num ** 3)}


def generate_square_root():
    root = random.randint(1, 100)
    num = root * root
    return {"question": f"√{num} = ?", "correctAnswer": str(root)}


def generate_table(table_from=2, table_to=12, mult_from=1, mult_to=12):
    t = random.randint(table_from, table_to)
    m = random.randint(mult_from, mult_to)
    return {"question": f"{t} × {m} = ?", "correctAnswer": str(t * m)}


# Maps a topic name to its generator + how many positional args it needs from PracticeRequest
GENERATORS = {
    "addition": lambda req: generate_addition(req.digits, req.terms, req.allow_decimals),
    "subtraction": lambda req: generate_subtraction(req.digits, req.terms, req.allow_decimals),
    "multiplication": lambda req: generate_multiplication(req.digits, req.terms, req.allow_decimals),
    "division": lambda req: generate_division(req.digits, req.allow_decimals),
    "square": lambda req: generate_square(),
    "cube": lambda req: generate_cube(),
    "square-root": lambda req: generate_square_root(),
    "tables": lambda req: generate_table(req.table_from, req.table_to, req.multiplier_from, req.multiplier_to),
}


def generate_practice_set(topic: str, req) -> list[dict]:
    """Generates `req.count` questions for the given topic, each with 4 MCQ options."""
    if topic not in GENERATORS:
        raise ValueError(f"Unknown practice topic: {topic}")

    generator = GENERATORS[topic]
    questions = []
    for _ in range(req.count):
        q = generator(req)
        try:
            numeric_answer = float(q["correctAnswer"])
            options = generate_options(numeric_answer)
        except ValueError:
            options = [q["correctAnswer"]]
        questions.append({
            "question": q["question"],
            "correctAnswer": q["correctAnswer"],
            "options": options,
        })
    return questions
