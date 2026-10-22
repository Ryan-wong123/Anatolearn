function validQuestion(value) {
    return typeof value.question === 'string' && value.question.trim() &&
        (value.format === 'mcq' ? ['option_a', 'option_b', 'option_c', 'option_d'].every((key) => typeof value[key] === 'string' && value[key].trim()) && ['A', 'B', 'C', 'D'].includes(value.correct_option)
            : value.format === 'open_ended' && typeof value.model_answer === 'string' && value.model_answer.trim());
}

module.exports = { validQuestion };
