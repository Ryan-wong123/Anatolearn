function validQuestion(value) {
  return typeof value.question === 'string' && value.question.trim() &&
    (value.format === 'mcq' ? ['option_a','option_b','option_c','option_d'].every((key) => typeof value[key] === 'string' && value[key].trim()) && ['A','B','C','D'].includes(value.correct_option)
      : value.format === 'open_ended' && typeof value.model_answer === 'string' && value.model_answer.trim());
}
function registerQuestionBank(app,pool,authenticate,requireTeacher) {
  app.get('/api/question-bank',authenticate,requireTeacher,async(req,res)=>{
    const rows = (await pool.query('SELECT * FROM question_bank ORDER BY category NULLS LAST,id')).rows;
    res.json(rows);
  });
  app.post('/api/question-bank/from-question/:id',authenticate,requireTeacher,async(req,res)=>{
    const q=(await pool.query('SELECT * FROM quiz_questions WHERE id=$1',[req.params.id])).rows[0];
    if (!q) return res.sendStatus(404);
    const row=(await pool.query(`INSERT INTO question_bank(question,format,category,option_a,option_b,option_c,option_d,correct_option,model_answer)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[q.question,q.format,req.body.category || q.category,q.option_a,q.option_b,q.option_c,q.option_d,q.correct_option,q.model_answer])).rows[0];
    res.status(201).json(row);
  });
  app.put('/api/question-bank/:id',authenticate,requireTeacher,async(req,res)=>{
    const q=req.body;
    if (!validQuestion(q)) return res.status(400).json({message:'Complete the question and its answer fields'});
    const row=(await pool.query(`UPDATE question_bank SET question=$1,format=$2,category=$3,option_a=$4,option_b=$5,option_c=$6,option_d=$7,correct_option=$8,model_answer=$9 WHERE id=$10 RETURNING *`,
      [q.question,q.format,q.category||null,q.format==='mcq'?q.option_a:null,q.format==='mcq'?q.option_b:null,q.format==='mcq'?q.option_c:null,q.format==='mcq'?q.option_d:null,q.format==='mcq'?q.correct_option:null,q.format==='open_ended'?q.model_answer:null,req.params.id])).rows[0];
    if (!row) return res.sendStatus(404);
    res.json(row);
  });
  app.delete('/api/question-bank/:id',authenticate,requireTeacher,async(req,res)=>{
    await pool.query('DELETE FROM question_bank WHERE id=$1',[req.params.id]);res.json({message:'Question removed from bank; quiz copies are retained'});
  });
  app.post('/api/quizzes/:id/bank-questions/:bankId',authenticate,requireTeacher,async(req,res)=>{
    const row = await require('./quizQuestions').withEditableQuiz(pool,req.params.id,async(client)=>{
      const q=(await client.query('SELECT * FROM question_bank WHERE id=$1',[req.params.bankId])).rows[0];
      if(!q)throw Object.assign(new Error('Bank question not found'),{status:404});
      return (await client.query(`INSERT INTO quiz_questions(quiz_id,question,format,category,option_a,option_b,option_c,option_d,correct_option,model_answer) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[req.params.id,q.question,q.format,q.category,q.option_a,q.option_b,q.option_c,q.option_d,q.correct_option,q.model_answer])).rows[0];
    });
    res.status(201).json(row);
  });
}
module.exports={registerQuestionBank,validQuestion};
